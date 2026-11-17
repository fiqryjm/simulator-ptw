import { Role } from '@prisma/client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
}

export class AuthenticationError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Forbidden: insufficient role permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TenantAccessError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Forbidden: cross-tenant access denied') {
    super(message);
    this.name = 'TenantAccessError';
  }
}

export const ROLE_DASHBOARD_SLUGS: Record<Role, string> = {
  APPLICANT: 'applicant',
  SUPERVISOR: 'supervisor',
  ISSUER: 'issuer',
  COORDINATOR: 'coordinator',
  INSTRUCTOR: 'instructor',
  TENANT_ADMIN: 'tenant-admin',
  SUPER_ADMIN: 'super-admin',
};

export function getDashboardPathForRole(role: Role): string {
  return `/dashboard/${ROLE_DASHBOARD_SLUGS[role]}`;
}

export interface SessionRoleContext {
  id: string;
  instructorId?: string;
  participants?: Array<{
    userId: string;
    simulatedRole: Role;
  }>;
}

/**
 * Resolves the effective role of a user within a training session.
 * Reads Participant.simulatedRole when session participants are provided;
 * throws AuthorizationError (403) if the user is neither a participant nor the session instructor/admin.
 */
export function getEffectiveRole(
  user: SessionUser,
  session?: SessionRoleContext | null,
): Role {
  if (!session || !session.participants) {
    return user.role;
  }

  const participant = session.participants.find((p) => p.userId === user.id);
  if (participant) {
    return participant.simulatedRole;
  }

  if (
    session.instructorId === user.id ||
    user.role === Role.TENANT_ADMIN ||
    user.role === Role.SUPER_ADMIN
  ) {
    return user.role;
  }

  throw new AuthorizationError('Anda bukan peserta atau instruktur pada sesi pelatihan ini');
}

/**
 * Pure RBAC check against a resolved session user.
 * Throws AuthenticationError (401) if unauthenticated or AuthorizationError (403) if role not allowed.
 */
export function assertRole(
  user: SessionUser | null | undefined,
  allowedRoles: readonly Role[],
): SessionUser {
  if (!user) {
    throw new AuthenticationError();
  }
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Role ${user.role} is not permitted. Required: ${allowedRoles.join(', ')}`,
    );
  }
  return user;
}

/**
 * Ensures the target resource belongs to the user's tenant.
 * Prevents Tenant A users from reading or mutating Tenant B data.
 */
export function assertTenantAccess(user: SessionUser, resourceTenantId: string): void {
  if (!user.tenantId || user.tenantId !== resourceTenantId) {
    throw new TenantAccessError();
  }
}
