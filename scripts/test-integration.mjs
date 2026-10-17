// Runs the integration tests against DATABASE_URL_TEST so they never truncate the dev/demo database.
// Applies migrations to the test database first (`prisma migrate deploy` creates it if missing).
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** host:port/database, with loopback aliases and the default port normalized, so spelling differences can't hide a match. */
const databaseKey = (url) => {
  const { hostname, port, pathname } = new URL(url);
  const host = LOOPBACK.has(hostname.toLowerCase()) ? 'localhost' : hostname.toLowerCase();
  return `${host}:${port || '5432'}${pathname}`;
};

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.error('DATABASE_URL_TEST is not set. Add it to .env (see .env.example).');
  process.exit(1);
}
if (process.env.DATABASE_URL && databaseKey(testUrl) === databaseKey(process.env.DATABASE_URL)) {
  console.error('DATABASE_URL_TEST must point to a different database than DATABASE_URL.');
  process.exit(1);
}

// The app and Prisma CLI read DATABASE_URL, so point it at the test database for these child processes only.
const env = { ...process.env, DATABASE_URL: testUrl };
// A shell is needed only to resolve `pnpm` on Windows; node itself is spawned directly (its path may contain spaces).
const run = (command, args, shell = false) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell });
  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
  }
  return result.status ?? 1;
};

const migrated = run('pnpm', ['prisma', 'migrate', 'deploy'], process.platform === 'win32');
if (migrated !== 0) {
  process.exit(migrated);
}
process.exit(
  run(process.execPath, [
    '--experimental-vm-modules',
    'node_modules/jest/bin/jest.js',
    '--testPathPatterns=tests/integration',
    '--runInBand',
    '--passWithNoTests',
    ...process.argv.slice(2),
  ]),
);
