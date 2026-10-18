import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { testDatabaseUrl } from './e2e/support/test-database';

/**
 * E2E smoke tests (ADR-0002 Amendment 1). Not part of `pnpm verify`.
 * Both servers are started here against the TEST database; busy ports fail the run instead of reusing a dev server.
 */
const testUrl = testDatabaseUrl();
const inherited = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const serverEnv = { ...inherited, DATABASE_URL: testUrl, NEXT_TELEMETRY_DISABLED: '1' };

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API',
      // Web servers start before globalSetup, so a fresh test database is migrated here, before the API boots.
      command: 'pnpm prisma migrate deploy && pnpm build && node dist/main',
      url: 'http://localhost:3000/dealerships',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      name: 'Frontend',
      command: 'pnpm --filter frontend build && pnpm --filter frontend start',
      url: 'http://localhost:3001',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
