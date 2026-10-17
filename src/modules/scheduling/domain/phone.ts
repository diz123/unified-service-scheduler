/** Phones are compared exactly after removing spaces; no country-code normalization (DESIGN.md). */
export function normalizePhone(phone: string): string {
  return phone.replace(/ /g, '');
}
