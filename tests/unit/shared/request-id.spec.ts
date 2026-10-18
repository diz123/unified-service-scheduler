import { resolveRequestId } from '../../../src/shared/presentation/request-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId — reuse a valid incoming X-Request-Id (O-2, T8.1)', () => {
  it('T8.1a a UUID is reused unchanged', () => {
    const incoming = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  it('T8.1b a 64-character value of letters, digits, ".", "_" and "-" is reused unchanged', () => {
    const incoming = `${'Ab9._-'.repeat(10)}Zz09`;

    expect([incoming.length, resolveRequestId(incoming)]).toStrictEqual([64, incoming]);
  });
});

describe('resolveRequestId — an invalid incoming value is replaced by a new UUID v4 (O-2, T8.2)', () => {
  it.each([
    ['T8.2a an empty string', ''],
    ['T8.2b 65 characters', 'a'.repeat(65)],
    ['T8.2c a value containing a space', 'abc def'],
    ['T8.2d a value containing a newline', 'abc\ndef'],
  ])('%s is replaced', (_case, incoming) => {
    const id = resolveRequestId(incoming);

    expect([UUID_V4.test(id), id === incoming]).toStrictEqual([true, false]);
  });
});

describe('resolveRequestId — a missing header (O-2, T8.3)', () => {
  it('T8.3 yields a new UUID v4, and two calls yield different IDs', () => {
    const first = resolveRequestId(undefined);
    const second = resolveRequestId(undefined);

    expect([UUID_V4.test(first), UUID_V4.test(second), first === second]).toStrictEqual([true, true, false]);
  });
});
