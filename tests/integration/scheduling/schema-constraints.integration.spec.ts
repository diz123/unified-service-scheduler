import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createTestPrisma, sqlErrorOf, truncateAll } from '../support/database';
import {
  AppointmentRow,
  insertAppointment,
  insertCustomer,
  insertDealership,
  insertServiceBay,
  insertServiceType,
  insertTechnician,
  insertVehicle,
} from '../support/seed';

const prisma: PrismaClient = createTestPrisma();

// 09:00–10:00 and 10:00–11:00 local (UTC+7) on 2030-01-15
const NINE = new Date('2030-01-15T02:00:00Z');
const TEN = new Date('2030-01-15T03:00:00Z');
const ELEVEN = new Date('2030-01-15T04:00:00Z');
const NINE_THIRTY = new Date('2030-01-15T02:30:00Z');

interface Fixture {
  existing: AppointmentRow;
  dealershipId: string;
  serviceTypeId: string;
  customerId: string;
}

/** One Confirmed 09:00–10:00 appointment on Bay 01 / Tech 01 / vehicle 51A12345. */
async function seedExisting(status: 'Confirmed' | 'Cancelled' = 'Confirmed'): Promise<Fixture> {
  const dealershipId = await insertDealership(prisma);
  const serviceTypeId = await insertServiceType(prisma, dealershipId);
  const customerId = await insertCustomer(prisma);
  const existing: AppointmentRow = {
    customerId,
    vehicleId: await insertVehicle(prisma, customerId, '51A12345'),
    dealershipId,
    serviceTypeId,
    serviceBayId: await insertServiceBay(prisma, dealershipId, 'Bay 01'),
    technicianId: await insertTechnician(prisma, dealershipId, 'Tech 01'),
    startTime: NINE,
    endTime: TEN,
    status,
  };
  await insertAppointment(prisma, existing);
  return { existing, dealershipId, serviceTypeId, customerId };
}

/** A row that shares nothing with `existing` except what `overrides` sets. */
async function otherResources(fixture: Fixture): Promise<AppointmentRow> {
  return {
    ...fixture.existing,
    vehicleId: await insertVehicle(prisma, fixture.customerId, '51A99999'),
    serviceBayId: await insertServiceBay(prisma, fixture.dealershipId, 'Bay 02'),
    technicianId: await insertTechnician(prisma, fixture.dealershipId, 'Tech 02'),
  };
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Appointment exclusion constraints (ADR-0001 Layer 2, T3.15)', () => {
  it('T3.15a overlapping Confirmed appointments on the same bay are rejected by appointment_bay_no_overlap', async () => {
    const fixture = await seedExisting();
    const row = { ...(await otherResources(fixture)), serviceBayId: fixture.existing.serviceBayId };

    const error = await sqlErrorOf(insertAppointment(prisma, { ...row, startTime: NINE_THIRTY, endTime: ELEVEN }));

    expect(error.code).toBe('23P01');
    expect(error.message).toContain('appointment_bay_no_overlap');
  });

  it('T3.15b overlapping Confirmed appointments for the same technician are rejected by appointment_technician_no_overlap', async () => {
    const fixture = await seedExisting();
    const row = { ...(await otherResources(fixture)), technicianId: fixture.existing.technicianId };

    const error = await sqlErrorOf(insertAppointment(prisma, { ...row, startTime: NINE_THIRTY, endTime: ELEVEN }));

    expect(error.code).toBe('23P01');
    expect(error.message).toContain('appointment_technician_no_overlap');
  });

  it('T3.15c overlapping Confirmed appointments for the same vehicle are rejected by appointment_vehicle_no_overlap', async () => {
    const fixture = await seedExisting();
    const row = { ...(await otherResources(fixture)), vehicleId: fixture.existing.vehicleId };

    const error = await sqlErrorOf(insertAppointment(prisma, { ...row, startTime: NINE_THIRTY, endTime: ELEVEN }));

    expect(error.code).toBe('23P01');
    expect(error.message).toContain('appointment_vehicle_no_overlap');
  });

  it('T3.15d touching [) intervals on the same bay, technician and vehicle are accepted', async () => {
    const fixture = await seedExisting();

    await expect(insertAppointment(prisma, { ...fixture.existing, startTime: TEN, endTime: ELEVEN })).resolves.toBe(1);
  });

  it('T3.15e an overlap with a Cancelled appointment on the same bay, technician and vehicle is accepted', async () => {
    const fixture = await seedExisting('Cancelled');

    await expect(
      insertAppointment(prisma, { ...fixture.existing, status: 'Confirmed', startTime: NINE_THIRTY, endTime: ELEVEN }),
    ).resolves.toBe(1);
  });
});

describe('Dealership working hours (A-4, T3.17)', () => {
  it('T3.17a a dealership with openTime after closeTime is rejected by a CHECK constraint', async () => {
    const error = await sqlErrorOf(insertDealership(prisma, '17:00', '08:00'));

    expect(error.code).toBe('23514');
  });

  it('T3.17b a dealership with openTime equal to closeTime is rejected by a CHECK constraint', async () => {
    const error = await sqlErrorOf(insertDealership(prisma, '08:00', '08:00'));

    expect(error.code).toBe('23514');
  });
});

describe('Vehicle license plate uniqueness (T3.18)', () => {
  it('T3.18 two vehicles with the same normalized licensePlate are rejected by a unique constraint', async () => {
    const customerId = await insertCustomer(prisma);
    await insertVehicle(prisma, customerId, '51A12345');

    const error = await sqlErrorOf(insertVehicle(prisma, customerId, '51A12345'));

    expect(error.code).toBe('23505');
    expect(error.message).toContain('licensePlate');
  });
});

describe('Zero-length interval guards (A-16, T3.20–T3.21)', () => {
  const ELEVEN_ZERO_ONE = new Date('2030-01-15T04:01:00Z');

  it('T3.20a a ServiceType with durationMinutes = 0 is rejected by service_type_duration_positive', async () => {
    const dealershipId = await insertDealership(prisma);

    const error = await sqlErrorOf(insertServiceType(prisma, dealershipId, 0));

    expect([error.code, error.message.includes('service_type_duration_positive')]).toStrictEqual(['23514', true]);
  });

  it('T3.20b a ServiceType with durationMinutes = -30 is rejected by service_type_duration_positive', async () => {
    const dealershipId = await insertDealership(prisma);

    const error = await sqlErrorOf(insertServiceType(prisma, dealershipId, -30));

    expect([error.code, error.message.includes('service_type_duration_positive')]).toStrictEqual(['23514', true]);
  });

  it('T3.21a a Confirmed appointment with endTime = startTime is rejected by appointment_end_after_start', async () => {
    const row = await otherResources(await seedExisting());

    const error = await sqlErrorOf(insertAppointment(prisma, { ...row, startTime: ELEVEN, endTime: ELEVEN }));

    expect([error.code, error.message.includes('appointment_end_after_start')]).toStrictEqual(['23514', true]);
  });

  it('T3.21b a Confirmed appointment with endTime before startTime is rejected by appointment_end_after_start', async () => {
    const row = await otherResources(await seedExisting());

    const error = await sqlErrorOf(insertAppointment(prisma, { ...row, startTime: ELEVEN, endTime: TEN }));

    expect([error.code, error.message.includes('appointment_end_after_start')]).toStrictEqual(['23514', true]);
  });

  it('T3.21c-1 a ServiceType with durationMinutes = 1 is accepted', async () => {
    const dealershipId = await insertDealership(prisma);

    await expect(insertServiceType(prisma, dealershipId, 1)).resolves.toEqual(expect.any(String));
  });

  it('T3.21c-2 a one-minute Confirmed appointment is accepted', async () => {
    const row = await otherResources(await seedExisting());

    await expect(insertAppointment(prisma, { ...row, startTime: ELEVEN, endTime: ELEVEN_ZERO_ONE })).resolves.toBe(1);
  });
});
