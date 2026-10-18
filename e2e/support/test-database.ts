import { databaseKey } from '../../tests/integration/support/database';

const parse = (url: string, variable: string): URL => {
  try {
    return new URL(url);
  } catch {
    // Node's URL error carries the raw input (with any password); report only which variable is malformed.
    throw new Error(`${variable} is not a valid URL.`);
  }
};

/**
 * DATABASE_URL_TEST, after the same guard as scripts/test-integration.mjs plus a name check: the database name must
 * end in "_test" and must not be the DATABASE_URL (dev/demo) database. Errors never include the URL.
 */
export function testDatabaseUrl(): string {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) {
    throw new Error('DATABASE_URL_TEST is not set. Add it to .env (see .env.example).');
  }
  const name = parse(testUrl, 'DATABASE_URL_TEST').pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error('Refusing to run E2E: the DATABASE_URL_TEST database name must end in "_test".');
  }
  const devUrl = process.env.DATABASE_URL;
  // parse() first so a malformed DATABASE_URL fails with a clean message before databaseKey reads it.
  if (devUrl && parse(devUrl, 'DATABASE_URL') && databaseKey(devUrl) === databaseKey(testUrl)) {
    throw new Error('Refusing to run E2E: DATABASE_URL_TEST must point to a different database than DATABASE_URL.');
  }
  return testUrl;
}
