import { toUtcIso } from '../../lib/local-time';
import { BookingForm, buildBookingPayload, buildLookupPayload } from '../../lib/payloads';

const HCM = 'Asia/Ho_Chi_Minh';

const FORM: BookingForm = {
  name: 'Nguyen Van A',
  phone: '090 123 4567',
  licensePlate: '51a-123.45',
  make: '',
  model: '',
  dealershipId: 'dealership-1',
  serviceTypeId: 'service-type-1',
  date: '2026-11-02',
  time: '09:00',
  overnightConsent: false,
};

const keysOf = (value: object): string[] => Object.keys(value).sort();

describe('Booking payload (Round F2)', () => {
  it('F2.8 without optional fields, the body has exactly the required DTO keys', () => {
    expect(keysOf(buildBookingPayload(FORM, HCM))).toStrictEqual([
      'dealershipId',
      'licensePlate',
      'name',
      'phone',
      'serviceTypeId',
      'startTime',
    ]);
  });

  it('F2.8 with every optional field set, the body adds only make, model and overnightConsent', () => {
    const form = { ...FORM, make: 'Toyota', model: 'Vios', overnightConsent: true };

    expect(keysOf(buildBookingPayload(form, HCM))).toStrictEqual([
      'dealershipId',
      'licensePlate',
      'make',
      'model',
      'name',
      'overnightConsent',
      'phone',
      'serviceTypeId',
      'startTime',
    ]);
  });

  // Tokyo proves the timezone argument is used, not hardcoded (as F1.2/F1.3).
  it.each([HCM, 'Asia/Tokyo'])('F2.9 startTime is the local date and time in %s converted to UTC', (timezone) => {
    expect(buildBookingPayload(FORM, timezone).startTime).toBe(toUtcIso(FORM.date, FORM.time, timezone));
  });

  it.each([
    ['make', ''],
    ['make', '   '],
    ['model', ''],
    ['model', '   '],
  ])('F2.10 an empty or whitespace-only %s (%j) is omitted', (field, value) => {
    expect(field in buildBookingPayload({ ...FORM, [field]: value }, HCM)).toBe(false);
  });

  it.each([
    ['make', 'Toyota'],
    ['model', 'Vios'],
  ])('F2.10 a non-empty %s is sent as entered', (field, value) => {
    expect(buildBookingPayload({ ...FORM, [field]: value }, HCM)).toMatchObject({ [field]: value });
  });

  it('F2.11 licensePlate is sent exactly as entered; normalization stays in the API', () => {
    expect(buildBookingPayload(FORM, HCM).licensePlate).toBe('51a-123.45');
  });

  it('F2.11 phone is sent exactly as entered; normalization stays in the API', () => {
    expect(buildBookingPayload(FORM, HCM).phone).toBe('090 123 4567');
  });

  it('F2.12 overnightConsent is true when the customer ticked it (I-11)', () => {
    expect(buildBookingPayload({ ...FORM, overnightConsent: true }, HCM).overnightConsent).toBe(true);
  });

  it('F2.12 overnightConsent is omitted, never sent as false, when not ticked', () => {
    expect('overnightConsent' in buildBookingPayload(FORM, HCM)).toBe(false);
  });
});

describe('Lookup payload (Round F2)', () => {
  it('F2.13 the body is exactly { licensePlate, phone }, values as entered', () => {
    expect(buildLookupPayload({ licensePlate: '51a-123.45', phone: '090 123 4567' })).toStrictEqual({
      licensePlate: '51a-123.45',
      phone: '090 123 4567',
    });
  });
});
