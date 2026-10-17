import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';

const TEST_POOL_SIZE = 20;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** host:port/database, with loopback aliases and the default port normalized, so spelling differences can't hide a match. */
const databaseKey = (url: string): string => {
  const { hostname, port, pathname } = new URL(url);
  const host = LOOPBACK.has(hostname.toLowerCase()) ? 'localhost' : hostname.toLowerCase();
  return `${host}:${port || '5432'}${pathname}`;
};

export function createTestPrisma(): PrismaClient {
  // The app under test reads DATABASE_URL; `pnpm test:integration` points it at DATABASE_URL_TEST.
  const testUrl = process.env['DATABASE_URL_TEST'];
  const appUrl = process.env['DATABASE_URL'];
  if (!testUrl || !appUrl || databaseKey(appUrl) !== databaseKey(testUrl)) {
    throw new Error('Run integration tests with `pnpm test:integration` so they use DATABASE_URL_TEST, never the dev database.');
  }
  // Concurrency tests run N = 10 parallel transactions (ADR-0001: pool size >= N); leave headroom for row counts.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl, max: TEST_POOL_SIZE }) });
}

/** Deletes all rows. Tests own the database pointed to by DATABASE_URL_TEST. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    TRUNCATE "Appointment", "Vehicle", "Customer", "Technician", "ServiceBay", "ServiceType", "Dealership" CASCADE`;
}

export interface SqlError {
  /** PostgreSQL SQLSTATE, e.g. `23P01`. */
  code: string;
  /** PostgreSQL message; names the violated constraint. */
  message: string;
}

/** Awaits a raw query expected to fail and returns its PostgreSQL error. */
export async function sqlErrorOf(query: Promise<unknown>): Promise<SqlError> {
  try {
    await query;
  } catch (error) {
    // Prisma's driver adapter exposes the PostgreSQL error as `originalCode` / `originalMessage` for every kind.
    const cause = (
      error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string; originalMessage?: string } } } }
    ).meta?.driverAdapterError?.cause;
    if (cause?.originalCode && cause.originalMessage) {
      return { code: cause.originalCode, message: cause.originalMessage };
    }
    throw error;
  }
  throw new Error('Expected the query to fail, but it succeeded');
}
