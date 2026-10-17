import { normalizeLicensePlate } from '../../../src/modules/scheduling/domain/license-plate';

describe('License plate normalization (Vehicle.licensePlate)', () => {
  it('T1.13 uppercases and removes spaces, "-" and "."', () => {
    expect(normalizeLicensePlate('51a-123.45')).toBe('51A12345');
    expect(normalizeLicensePlate(' 51A 123 45 ')).toBe('51A12345');
  });

  it('T1.14 plates differing only by case, spaces, "-" or "." normalize to the same value', () => {
    expect(normalizeLicensePlate('51a-123.45')).toBe(normalizeLicensePlate('51A 12345'));
  });
});
