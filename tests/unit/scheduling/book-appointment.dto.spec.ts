import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookAppointmentDto } from '../../../src/modules/scheduling/presentation/dtos/book-appointment.dto';

const VALID = {
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

/** Properties that failed validation; any entry means the global ValidationPipe answers 400. */
async function invalidProperties(payload: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(BookAppointmentDto, payload));
  return errors.map((error) => error.property);
}

function without(field: string): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...VALID };
  delete payload[field];
  return payload;
}

describe('BookAppointmentDto — Validation order step 1 (T4.2)', () => {
  it.each(['name', 'phone', 'licensePlate', 'dealershipId', 'serviceTypeId', 'startTime'])(
    'T4.2 a missing required field "%s" is rejected',
    async (field) => {
      expect(await invalidProperties(without(field))).toStrictEqual([field]);
    },
  );

  it('T4.2 a startTime that is not ISO 8601 is rejected', async () => {
    expect(await invalidProperties({ ...VALID, startTime: '15/01/2030 09:00' })).toStrictEqual(['startTime']);
  });

  it.each(['2030-02-30T02:00:00Z', '2030-01-15T25:00:00Z'])(
    'T4.2 a well-formed but impossible startTime "%s" is rejected',
    async (startTime) => {
      expect(await invalidProperties({ ...VALID, startTime })).toStrictEqual(['startTime']);
    },
  );

  it.each(['dealershipId', 'serviceTypeId'])('T4.2 an empty "%s" is rejected', async (field) => {
    expect(await invalidProperties({ ...VALID, [field]: '' })).toStrictEqual([field]);
  });

  it('T4.2 an overnightConsent that is not a boolean is rejected', async () => {
    expect(await invalidProperties({ ...VALID, overnightConsent: 'yes' })).toStrictEqual(['overnightConsent']);
  });

  it('T4.2 a name that is blank after trimming is rejected (A-11)', async () => {
    expect(await invalidProperties({ ...VALID, name: '   ' })).toStrictEqual(['name']);
  });

  it('T4.2 a licensePlate with no letter or digit after normalization is rejected (A-11)', async () => {
    expect(await invalidProperties({ ...VALID, licensePlate: ' - . ' })).toStrictEqual(['licensePlate']);
  });

  it('T4.2 a phone with no digit after removing spaces is rejected (A-11)', async () => {
    expect(await invalidProperties({ ...VALID, phone: '   ' })).toStrictEqual(['phone']);
  });

  it('T4.2 make, model and overnightConsent may be omitted', async () => {
    const payload = without('make');
    delete payload['model'];
    delete payload['overnightConsent'];

    expect(await invalidProperties(payload)).toStrictEqual([]);
  });
});

describe('BookAppointmentDto — startTime format (T4.3, T4.4)', () => {
  it('T4.3 a startTime with an offset other than Z is rejected', async () => {
    expect(await invalidProperties({ ...VALID, startTime: '2030-01-15T09:00:00+07:00' })).toStrictEqual(['startTime']);
  });

  it('T4.4 a startTime with non-zero seconds is rejected', async () => {
    expect(await invalidProperties({ ...VALID, startTime: '2030-01-15T02:00:30Z' })).toStrictEqual(['startTime']);
  });

  it.each(['2030-01-15T02:00Z', '2030-01-15T02:00:00.0000Z', '2030-01-15T02:00:00z'])(
    'T4.4 a startTime "%s" without seconds, with more than 3 fraction digits, or with lowercase z is rejected (A-13)',
    async (startTime) => {
      expect(await invalidProperties({ ...VALID, startTime })).toStrictEqual(['startTime']);
    },
  );

  it('T4.4 a startTime with non-zero milliseconds is rejected', async () => {
    expect(await invalidProperties({ ...VALID, startTime: '2030-01-15T02:00:00.500Z' })).toStrictEqual(['startTime']);
  });
});
