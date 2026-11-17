import { Role, SessionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AuthorizationError, getEffectiveRole, type SessionUser } from '@/lib/rbac';
import {
  generateJoinCode,
  getInstructorSessionSummary,
  joinSessionByCode,
  resetSession,
  swapParticipantRole,
} from '@/modules/session/service';

const instructorA: SessionUser = {
  id: 'inst-a',
  email: 'inst@a.local',
  name: 'Instructor A',
  role: Role.INSTRUCTOR,
  tenantId: 'tenant-a',
};

const participantA: SessionUser = {
  id: 'user-a',
  email: 'user@a.local',
  name: 'User A',
  role: Role.APPLICANT,
  tenantId: 'tenant-a',
};

const instructorB: SessionUser = {
  id: 'inst-b',
  email: 'inst@b.local',
  name: 'Instructor B',
  role: Role.INSTRUCTOR,
  tenantId: 'tenant-b',
};

describe('M2 Session Service, Join Code, Effective Role & Reset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates unambiguous joinCode without 0/O/1/I/L', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateJoinCode(6);
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('resolves getEffectiveRole from Participant.simulatedRole and rejects non-participants', () => {
    const session = {
      id: 'sess-1',
      instructorId: 'inst-a',
      participants: [{ userId: 'user-a', simulatedRole: Role.SUPERVISOR }],
    };

    expect(getEffectiveRole(participantA, session)).toBe(Role.SUPERVISOR);
    expect(getEffectiveRole(instructorA, session)).toBe(Role.INSTRUCTOR);
    expect(() =>
      getEffectiveRole(
        { ...participantA, id: 'stranger' },
        session,
      ),
    ).toThrow(AuthorizationError);
  });

  it('blocks cross-tenant joinSessionByCode and closed sessions', async () => {
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-b',
      tenantId: 'tenant-b',
      status: SessionStatus.ACTIVE,
      participants: [],
    } as never);

    await expect(joinSessionByCode(participantA, 'ABC234')).rejects.toMatchObject({
      statusCode: 404,
    });

    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-a',
      tenantId: 'tenant-a',
      status: SessionStatus.COMPLETED,
      participants: [],
    } as never);

    await expect(joinSessionByCode(participantA, 'ABC234')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('blocks participant from calling instructor summary / stream / export (403) and blocks cross-tenant (403)', async () => {
    await expect(getInstructorSessionSummary(participantA, 'sess-1')).rejects.toThrow(
      AuthorizationError,
    );

    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-a',
      tenantId: 'tenant-a',
      instructorId: 'inst-a',
      scenario: { id: 'sc-1', title: 'S1', industry: 'OIL_AND_GAS', seededErrorsJson: [] },
      participants: [],
      permits: [],
    } as never);

    await expect(getInstructorSessionSummary(instructorB, 'sess-a')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('enforces optimistic locking version check on resetSession (409)', async () => {
    vi.spyOn(prisma.session, 'findUnique').mockResolvedValue({
      id: 'sess-a',
      tenantId: 'tenant-a',
      instructorId: 'inst-a',
      version: 2,
      scenario: { initialDataJson: {}, industry: 'OIL_AND_GAS' },
      participants: [],
      permits: [],
    } as never);

    await expect(resetSession(instructorA, 'sess-a', 1)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('D-45.5 & D-47: swapParticipantRole blocks TENANT_ADMIN (403) and transfers only previous applicant permits with version bump', async () => {
    const tenantAdminA: SessionUser = { ...instructorA, id: 'admin-a', role: Role.TENANT_ADMIN };
    await expect(
      swapParticipantRole(tenantAdminA, 'sess-a', {
        participantId: 'p-2',
        simulatedRole: Role.APPLICANT,
      }),
    ).rejects.toThrow(AuthorizationError);

    const permitUpdates: Array<{ where: unknown; data: unknown }> = [];
    const auditLogs: Array<unknown> = [];

    vi.spyOn(prisma.session, 'findUnique')
      .mockResolvedValueOnce({
        id: 'sess-a',
        tenantId: 'tenant-a',
        instructorId: 'inst-a',
        participants: [
          { id: 'p-1', userId: 'u-prev-app', simulatedRole: Role.APPLICANT },
          { id: 'p-2', userId: 'u-new-app', simulatedRole: Role.SUPERVISOR },
        ],
        permits: [
          { id: 'perm-owned', applicantId: 'u-prev-app' },
          { id: 'perm-other', applicantId: 'u-other-user' },
        ],
      } as never)
      .mockResolvedValueOnce(null);

    vi.spyOn(prisma, '$transaction').mockImplementation((async (
      fn: (tx: unknown) => Promise<unknown>,
    ) => {
      const tx = {
        participant: {
          update: async ({ data }: { data: unknown }) => ({ id: 'p-2', ...(data as object) }),
        },
        permit: {
          update: async (args: { where: unknown; data: unknown }) => {
            permitUpdates.push(args);
            return {};
          },
        },
        auditLog: {
          create: async (args: { data: unknown }) => {
            auditLogs.push(args.data);
            return {};
          },
        },
      };
      return fn(tx);
    }) as never);

    await swapParticipantRole(instructorA, 'sess-a', {
      participantId: 'p-2',
      simulatedRole: Role.APPLICANT,
    });

    expect(permitUpdates).toHaveLength(1);
    expect(permitUpdates[0]).toEqual({
      where: { id: 'perm-owned' },
      data: { applicantId: 'u-new-app', currentVersion: { increment: 1 } },
    });
    expect(auditLogs[0]).toMatchObject({
      action: 'SWAP_PARTICIPANT_ROLE',
      metadataJson: {
        fromRole: Role.SUPERVISOR,
        toRole: Role.APPLICANT,
        changedPermitIds: ['perm-owned'],
      },
    });
  });
});
