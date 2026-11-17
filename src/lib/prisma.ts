import { PrismaClient, type Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Enforces tenantId filtering on any Prisma where clause.
 */
export function tenantWhere<T extends Record<string, unknown>>(
  tenantId: string,
  where?: T,
): T & { tenantId: string } {
  if (!tenantId) {
    throw new Error('tenantId is required for all tenant-scoped queries');
  }
  return {
    ...(where ?? ({} as T)),
    tenantId,
  };
}

/**
 * Provides a tenant-bound query helper so callers cannot omit tenantId.
 */
export function forTenant(tenantId: string) {
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  return {
    tenantId,
    where: <T extends Record<string, unknown>>(extra?: T) => tenantWhere(tenantId, extra),
    permit: {
      findMany: (args?: Omit<Prisma.PermitFindManyArgs, 'where'> & { where?: Prisma.PermitWhereInput }) =>
        prisma.permit.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
      findFirst: (args: Omit<Prisma.PermitFindFirstArgs, 'where'> & { where: Prisma.PermitWhereInput }) =>
        prisma.permit.findFirst({
          ...args,
          where: { ...args.where, tenantId },
        }),
    },
    session: {
      findMany: (args?: Omit<Prisma.SessionFindManyArgs, 'where'> & { where?: Prisma.SessionWhereInput }) =>
        prisma.session.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
    },
    user: {
      findMany: (args?: Omit<Prisma.UserFindManyArgs, 'where'> & { where?: Prisma.UserWhereInput }) =>
        prisma.user.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
    },
    scenario: {
      findMany: (args?: Omit<Prisma.ScenarioFindManyArgs, 'where'> & { where?: Prisma.ScenarioWhereInput }) =>
        prisma.scenario.findMany({
          ...args,
          where: { ...args?.where, tenantId },
        }),
    },
  };
}

export interface CrossTenantActor {
  id: string;
  role: string;
  tenantId: string;
}

/**
 * Explicit helper for SUPER_ADMIN cross-tenant operations.
 * Always writes an AuditLog entry before returning the result.
 */
export async function withCrossTenantAccess<T>(
  actor: CrossTenantActor,
  params: { action: string; entity: string; entityId: string; metadata?: Prisma.InputJsonValue },
  fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('FORBIDDEN: Only SUPER_ADMIN may perform cross-tenant access');
  }

  const result = await fn(prisma);

  await prisma.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      metadataJson: params.metadata,
    },
  });

  return result;
}
