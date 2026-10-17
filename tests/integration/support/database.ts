import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
}

/** Deletes all rows. Tests own the database pointed to by DATABASE_URL. */
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
