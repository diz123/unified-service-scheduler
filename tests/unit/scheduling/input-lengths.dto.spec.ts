import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeLicensePlate } from '../../../src/modules/scheduling/domain/license-plate';
import { BookAppointmentDto } from '../../../src/modules/scheduling/presentation/dtos/book-appointment.dto';
import { LookUpAppointmentsDto } from '../../../src/modules/scheduling/presentation/dtos/look-up-appointments.dto';

const VALID_BOOKING = {
  name: 'Nguyen Van A',
  phone: '0901234567',
  licensePlate: '51A-123.45',
  make: 'Toyota',
  model: 'Vios',
  dealershipId: 'dealership-1',
  serviceTypeId: 'service-type-1',
  startTime: '2030-01-15T02:00:00Z',
  overnightConsent: false,
};

const VALID_LOOKUP = { licensePlate: '51A-123.45', phone: '0901234567' };

type DtoClass = typeof BookAppointmentDto | typeof LookUpAppointmentsDto;

/** Each failed property with the names of its failed constraints; empty means the body is accepted. */
async function failures(dto: DtoClass, payload: Record<string, unknown>): Promise<[string, string[]][]> {
  const errors = await validate(plainToInstance(dto, payload));
  return errors.map((error) => [error.property, Object.keys(error.constraints ?? {})]);
}

/** A value of exactly `length` characters that passes the field's other rules (A-11). */
const valueOf = (field: string, length: number): string => (field === 'phone' ? '0' : 'A').repeat(length);

const BOOKING_LIMITS: [string, number][] = [
  ['name', 100],
  ['phone', 20],
  ['licensePlate', 20],
  ['make', 50],
  ['model', 50],
];

const LOOKUP_LIMITS: [string, number][] = [
  ['licensePlate', 20],
  ['phone', 20],
];

describe('Input lengths (DESIGN.md "Input lengths", Round 7)', () => {
  describe('T7.1 Book Appointment DTO', () => {
    it.each(BOOKING_LIMITS)('a "%s" of exactly %i characters is accepted', async (field, limit) => {
      expect(await failures(BookAppointmentDto, { ...VALID_BOOKING, [field]: valueOf(field, limit) })).toStrictEqual([]);
    });

    it.each(BOOKING_LIMITS)('a "%s" one character over %i is rejected on that field only', async (field, limit) => {
      expect(await failures(BookAppointmentDto, { ...VALID_BOOKING, [field]: valueOf(field, limit + 1) })).toStrictEqual([
        [field, ['maxLength']],
      ]);
    });
  });

  describe('T7.2 Look Up Appointments DTO', () => {
    it.each(LOOKUP_LIMITS)('a "%s" of exactly %i characters is accepted', async (field, limit) => {
      expect(await failures(LookUpAppointmentsDto, { ...VALID_LOOKUP, [field]: valueOf(field, limit) })).toStrictEqual([]);
    });

    it.each(LOOKUP_LIMITS)('a "%s" one character over %i is rejected on that field only', async (field, limit) => {
      expect(await failures(LookUpAppointmentsDto, { ...VALID_LOOKUP, [field]: valueOf(field, limit + 1) })).toStrictEqual([
        [field, ['maxLength']],
      ]);
    });
  });

  describe('T7.3 the limit is checked before normalization', () => {
    const plate = '51A 12.345 67.890-123';

    it('the plate is 21 characters raw but at most 20 once normalized', () => {
      expect([plate.length, normalizeLicensePlate(plate).length <= 20]).toStrictEqual([21, true]);
    });

    it.each([
      ['Book Appointment', BookAppointmentDto, VALID_BOOKING],
      ['Look Up Appointments', LookUpAppointmentsDto, VALID_LOOKUP],
    ] as const)('%s rejects that plate', async (_name, dto, valid) => {
      expect(await failures(dto, { ...valid, licensePlate: plate })).toStrictEqual([['licensePlate', ['maxLength']]]);
    });
  });
});
