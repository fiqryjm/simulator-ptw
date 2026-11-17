import { Industry, PermitStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { TenantAccessError, type SessionUser } from '@/lib/rbac';
import {
  getPermitDetail,
  savePermitSignature,
  transitionPermit,
  updateAdditionalPermit,
  updatePermitDraft,
} from '@/modules/permit/service';

const applicantA: SessionUser = {
  id: 'u-app-a',
  email: 'app@a.local',
  name: 'Applicant A',
  role: Role.APPLICANT,
  tenantId: 'tenant-a',
};

const supervisorA: SessionUser = {
  id: 'u-sup-a',
  email: 'sup@a.local',
  name: 'Supervisor A',
  role: Role.SUPERVISOR,
  tenantId: 'tenant-a',
};

const issuerA: SessionUser = {
  id: 'u-iss-a',
  email: 'iss@a.local',
  name: 'Issuer A',
  role: Role.ISSUER,
  tenantId: 'tenant-a',
};

const applicantB: SessionUser = {
  id: 'u-app-b',
  email: 'app@b.local',
  name: 'Applicant B',
  role: Role.APPLICANT,
  tenantId: 'tenant-b',
};

function makePermitRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'permit-1',
    tenantId: 'tenant-a',
    sessionId: 'sess-1',
    applicantId: 'u-app-a',
    status: PermitStatus.DRAFT,
    dataJson: {},
    validFrom: new Date('2026-11-17T08:00:00Z'),
    validTo: new Date('2026-11-17T17:00:00Z'),
    currentVersion: 1,
    tenant: { id: 'tenant-a', name: 'Tenant A', settings: {} },
    applicant: { id: 'u-app-a', name: 'Applicant A', email: 'app@a.local' },
    session: { id: 'sess-1', scenario: { id: 'sc-1', title: 'S1', industry: Industry.OIL_AND_GAS } },
    additionalPermits: [],
    jsaRecords: [],
    signatures: [],
    transitions: [],
    supervisionNotes: [],
    versions: [],
    ...overrides,
  };
}

describe('Permit Service Guards, RBAC, Tenant Isolation & Optimistic Locking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.formTemplate, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.formTemplate, 'findMany').mockResolvedValue([]);
  });

  it('denies Tenant B user reading Tenant A permit (TenantAccessError 403)', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(makePermitRecord() as never);
    await expect(getPermitDetail(applicantB, 'permit-1')).rejects.toThrow(TenantAccessError);
  });

  it('returns 409 on optimistic locking version conflict in updatePermitDraft and transitionPermit', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({ currentVersion: 3 }) as never,
    );

    await expect(
      updatePermitDraft(applicantA, 'permit-1', { expectedVersion: 2, dataJson: {} }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      transitionPermit(applicantA, 'permit-1', {
        toStatus: PermitStatus.SUBMITTED,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects PATCH data PTW after permit is SUBMITTED (409)', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({ status: PermitStatus.SUBMITTED, currentVersion: 2 }) as never,
    );

    await expect(
      updatePermitDraft(applicantA, 'permit-1', { expectedVersion: 2, dataJson: {} }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects negative RBAC transitions with 403: APPLICANT approving & SUPERVISOR issuing', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({ status: PermitStatus.SUBMITTED, currentVersion: 2 }) as never,
    );

    await expect(
      transitionPermit(applicantA, 'permit-1', {
        toStatus: PermitStatus.PENDING_ISSUANCE,
        expectedVersion: 2,
        comment: 'Trying to self-approve',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({ status: PermitStatus.PENDING_ISSUANCE, currentVersion: 3 }) as never,
    );

    await expect(
      transitionPermit(supervisorA, 'permit-1', {
        toStatus: PermitStatus.APPROVED,
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('enforces strict signature validation (PNG only, <= 200KB, matching role)', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({ status: PermitStatus.DRAFT }) as never,
    );

    await expect(
      savePermitSignature(supervisorA, 'permit-1', {
        role: Role.APPLICANT,
        imageData: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      savePermitSignature(applicantA, 'permit-1', {
        role: Role.APPLICANT,
        imageData: 'data:image/jpeg;base64,abc',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    const oversizedBase64 = Buffer.alloc(210 * 1024, 1).toString('base64');
    await expect(
      savePermitSignature(applicantA, 'permit-1', {
        role: Role.APPLICANT,
        imageData: `data:image/png;base64,${oversizedBase64}`,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('prevents ISSUER from approving an AdditionalPermit with missing required fields (422)', async () => {
    vi.spyOn(prisma.permit, 'findUnique').mockResolvedValue(
      makePermitRecord({
        status: PermitStatus.PENDING_ISSUANCE,
        additionalPermits: [
          {
            id: 'add-1',
            type: 'HOT_WORK',
            status: 'DRAFT',
            dataJson: {},
          },
        ],
      }) as never,
    );

    await expect(
      updateAdditionalPermit(issuerA, 'permit-1', 'add-1', { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
