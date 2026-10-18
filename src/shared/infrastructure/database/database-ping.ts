import { PrismaClient } from './generated/client';

/** Resolves when the database answers; rejects otherwise (DESIGN.md O-4). */
export type DatabasePing = () => Promise<unknown>;

/** Injection token for the health check's database ping, so tests can override it. */
export const DATABASE_PING = Symbol('DATABASE_PING');

export function createDatabasePing(prisma: PrismaClient): DatabasePing {
  return () => prisma.$queryRaw`SELECT 1`;
}
