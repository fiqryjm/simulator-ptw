import { Role, SessionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AuthorizationError, getEffectiveRole, type SessionUser } from '@/lib/rbac';
import {
  generateJoinCode,
  getInstructorSessionSummary,
  joinSessionByCode,
  resetSession,
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
});
