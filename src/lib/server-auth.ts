import { Role } from '@prisma/client';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { assertRole, getDashboardPathForRole, type SessionUser } from '@/lib/rbac';

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role || !session.user.tenantId) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    tenantId: session.user.tenantId,
  };
}

/**
 * Server-side helper to enforce authentication and allowed roles.
 * Throws AuthenticationError / AuthorizationError for API routes, or can redirect in pages.
 */
export async function requireRole(
  allowedRoles: readonly Role[],
  options: { redirectOnFail?: boolean } = {},
): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (options.redirectOnFail) {
    if (!user) {
      redirect('/login');
    }
    if (!allowedRoles.includes(user.role)) {
      redirect(getDashboardPathForRole(user.role));
    }
    return user;
  }

  return assertRole(user, allowedRoles);
}
