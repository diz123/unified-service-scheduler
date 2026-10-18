import 'dotenv/config';
import { seed } from '../prisma/seed';
import { createTestPrisma } from '../tests/integration/support/database';
import { testDatabaseUrl } from './support/test-database';

/** Test database only (migrated by the API server command, which starts first): remove bookings, re-seed. */
export default async function globalSetup(): Promise<void> {
  const testUrl = testDatabaseUrl();

  // createTestPrisma insists DATABASE_URL and DATABASE_URL_TEST name the same database. Restore the original value
  // afterwards: test workers inherit this environment and re-run the config's guard against it.
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testUrl;
  const prisma = createTestPrisma();
  try {
    await prisma.$transaction([prisma.appointment.deleteMany(), prisma.vehicle.deleteMany(), prisma.customer.deleteMany()]);
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  }
}
