import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  AuthorizationError,
  TenantAccessError,
  assertRole,
  assertTenantAccess,
  type SessionUser,
} from '@/lib/rbac';
import { forTenant, prisma, tenantWhere, withCrossTenantAccess } from '@/lib/prisma';

const tenantAUser: SessionUser = {
  id: 'user-a1',
  email: 'applicant@tenant-a.local',
  name: 'User Tenant A',
  role: Role.APPLICANT,
  tenantId: 'tenant-a',
};

const superAdminUser: SessionUser = {
  id: 'user-sa',
  email: 'superadmin@system.ptw.local',
  name: 'Super Admin',
  role: Role.SUPER_ADMIN,
  tenantId: 'tenant-system',
};

describe('RBAC & Multi-Tenant Isolation', () => {
  it('enforces assertRole for allowed and disallowed roles', () => {
    expect(() => assertRole(null, [Role.APPLICANT])).toThrow(AuthenticationError);
    expect(() => assertRole(tenantAUser, [Role.ISSUER])).toThrow(AuthorizationError);
    expect(assertRole(tenantAUser, [Role.APPLICANT, Role.SUPERVISOR])).toEqual(tenantAUser);
  });

  it('prevents Tenant A user from accessing Tenant B resources', () => {
    expect(() => assertTenantAccess(tenantAUser, 'tenant-a')).not.toThrow();
    expect(() => assertTenantAccess(tenantAUser, 'tenant-b')).toThrow(TenantAccessError);
  });

  it('forces tenantId filter on scoped queries so Tenant A cannot read Tenant B data', async () => {
    const mockPermits = [
      { id: 'p-1', tenantId: 'tenant-a', status: 'DRAFT' },
      { id: 'p-2', tenantId: 'tenant-b', status: 'DRAFT' },
    ];

    const findManySpy = vi
      .spyOn(prisma.permit, 'findMany')
      .mockImplementation((async (args?: { where?: { tenantId?: string } }) => {
        const requestedTenantId = args?.where?.tenantId;
        return mockPermits.filter((p) => p.tenantId === requestedTenantId);
      }) as never);

    const tenantADb = forTenant('tenant-a');
    const results = await tenantADb.permit.findMany();

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.tenantId).toBe('tenant-a');

    // Even if someone passes another tenantId in where, tenantWhere overwrites it
    const enforced = tenantWhere('tenant-a', { tenantId: 'tenant-b', status: 'DRAFT' });
    expect(enforced.tenantId).toBe('tenant-a');

    findManySpy.mockRestore();
  });

  it('restricts withCrossTenantAccess to SUPER_ADMIN and writes AuditLog', async () => {
    await expect(
      withCrossTenantAccess(
        tenantAUser,
        { action: 'READ_ALL_TENANTS', entity: 'Tenant', entityId: '*' },
        async () => [],
      ),
    ).rejects.toThrow('FORBIDDEN');

    const auditCreateSpy = vi
      .spyOn(prisma.auditLog, 'create')
      .mockResolvedValue({ id: 'audit-1' } as never);

    const result = await withCrossTenantAccess(
      superAdminUser,
      { action: 'READ_ALL_TENANTS', entity: 'Tenant', entityId: '*' },
      async () => ['tenant-a', 'tenant-b'],
    );

    expect(result).toEqual(['tenant-a', 'tenant-b']);
    expect(auditCreateSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-system',
        actorId: 'user-sa',
        action: 'READ_ALL_TENANTS',
        entity: 'Tenant',
      }),
    });

    auditCreateSpy.mockRestore();
  });
});
