import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

/** Builds the application's Prisma client from DATABASE_URL; fails fast at startup if it is missing. */
export function createPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
