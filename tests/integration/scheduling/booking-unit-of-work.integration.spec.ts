import { BookAppointmentUseCase } from '../../../src/modules/scheduling/application/book-appointment.use-case';
import { BookAppointmentCommand } from '../../../src/modules/scheduling/application/commands/book-appointment.command';
import { Appointment } from '../../../src/modules/scheduling/domain/entities';
import {
  BayUnavailableException,
  TechnicianUnavailableException,
  VehicleUnavailableException,
} from '../../../src/modules/scheduling/domain/scheduling.exceptions';
import {
  PrismaBookingTransaction,
  PrismaBookingUnitOfWork,
} from '../../../src/modules/scheduling/infrastructure/database/prisma-booking-unit-of-work';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createTestPrisma, truncateAll } from '../support/database';
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
const useCase = new BookAppointmentUseCase(new PrismaBookingUnitOfWork(prisma), {
  now: () => new Date('2030-01-01T00:00:00Z'),
});

// Local UTC+7 on 2030-01-15
const NINE = new Date('2030-01-15T02:00:00Z');
const TEN = new Date('2030-01-15T03:00:00Z');
const ELEVEN = new Date('2030-01-15T04:00:00Z');
const PHONE = '0901234567';
const PLATE = '51A12345';

interface Dealer {
  dealershipId: string;
  serviceTypeId: string;
  bayId: string;
  technicianId: string;
}

/** A dealership with one 60-minute service type, Bay 01 and a qualified Tech 01. */
async function seedDealer(): Promise<Dealer> {
  const dealershipId = await insertDealership(prisma);
  return {
    dealershipId,
    serviceTypeId: await insertServiceType(prisma, dealershipId),
    bayId: await insertServiceBay(prisma, dealershipId, 'Bay 01'),
    technicianId: await insertTechnician(prisma, dealershipId, 'Tech 01'),
  };
}

async function seedVehicle(): Promise<{ customerId: string; vehicleId: string }> {
  const customerId = await insertCustomer(prisma, PHONE);
  return { customerId, vehicleId: await insertVehicle(prisma, customerId, PLATE) };
}

function existingRow(
  dealer: Dealer,
  vehicle: { customerId: string; vehicleId: string },
  overrides: Partial<AppointmentRow> = {},
): AppointmentRow {
  return {
    ...vehicle,
    dealershipId: dealer.dealershipId,
    serviceTypeId: dealer.serviceTypeId,
    serviceBayId: dealer.bayId,
    technicianId: dealer.technicianId,
    startTime: NINE,
    endTime: TEN,
    ...overrides,
  };
}

function book(dealer: Dealer, startTime: Date, overrides: Partial<BookAppointmentCommand> = {}): Promise<Appointment> {
  return useCase.execute({
    name: 'Nguyen Van A',
    phone: PHONE,
    licensePlate: PLATE,
    dealershipId: dealer.dealershipId,
    serviceTypeId: dealer.serviceTypeId,
    startTime,
    ...overrides,
  });
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaBookingUnitOfWork — booking through the real database', () => {
  it('T3.1 a back-to-back booking at 10:00 on the same bay, technician and vehicle succeeds', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    await insertAppointment(prisma, existingRow(dealer, vehicle));

    const appointment = await book(dealer, TEN);

    expect(appointment).toMatchObject({
      status: 'Confirmed',
      serviceBayId: dealer.bayId,
      technicianId: dealer.technicianId,
      vehicleId: vehicle.vehicleId,
      startTime: TEN,
      endTime: ELEVEN,
    });
  });

  it('T3.2 an overlapping Cancelled appointment does not block the booking', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    await insertAppointment(prisma, existingRow(dealer, vehicle, { startTime: TEN, endTime: ELEVEN, status: 'Cancelled' }));

    const appointment = await book(dealer, TEN);

    expect(appointment).toMatchObject({
      status: 'Confirmed',
      serviceBayId: dealer.bayId,
      technicianId: dealer.technicianId,
      vehicleId: vehicle.vehicleId,
    });
  });

  it('T3.3 the same vehicle with an overlapping booking at another dealership is unavailable', async () => {
    const dealerA = await seedDealer();
    const dealerB = await seedDealer();
    const vehicle = await seedVehicle();
    await insertAppointment(prisma, existingRow(dealerB, vehicle, { startTime: TEN, endTime: ELEVEN }));
    // Dealership A's only bay is also busy, so only the vehicle query (step 6, before the bay check) can
    // produce VehicleUnavailableException; the database constraint would never be reached.
    const otherCustomerId = await insertCustomer(prisma, '0912345678');
    await insertAppointment(prisma, {
      ...existingRow(dealerA, vehicle, { startTime: TEN, endTime: ELEVEN }),
      customerId: otherCustomerId,
      vehicleId: await insertVehicle(prisma, otherCustomerId, '30E45678'),
      technicianId: await insertTechnician(prisma, dealerA.dealershipId, 'Tech 02'),
    });

    await expect(book(dealerA, TEN)).rejects.toThrow(VehicleUnavailableException);
  });

  it('T3.3b another vehicle with an overlapping booking does not block the requesting vehicle', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    // A different vehicle holds Bay 02 / Tech 02 at 10:00; Bay 01 / Tech 01 stay free.
    const otherCustomerId = await insertCustomer(prisma, '0912345678');
    await insertAppointment(prisma, {
      ...existingRow(dealer, vehicle, { startTime: TEN, endTime: ELEVEN }),
      customerId: otherCustomerId,
      vehicleId: await insertVehicle(prisma, otherCustomerId, '30E45678'),
      serviceBayId: await insertServiceBay(prisma, dealer.dealershipId, 'Bay 02'),
      technicianId: await insertTechnician(prisma, dealer.dealershipId, 'Tech 02'),
    });

    const appointment = await book(dealer, TEN);

    expect(appointment).toMatchObject({
      status: 'Confirmed',
      vehicleId: vehicle.vehicleId,
      serviceBayId: dealer.bayId,
      technicianId: dealer.technicianId,
    });
  });

  it('T3.4 the plate lookup normalizes the plate and reuses the stored vehicle', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();

    const appointment = await book(dealer, TEN, { licensePlate: '51a-123.45' });

    expect(appointment.vehicleId).toBe(vehicle.vehicleId);
    expect(await prisma.vehicle.count()).toBe(1);
  });

  it('T3.14 a rejected booking with a new plate creates no customer or vehicle', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    const spareTechnicianId = await insertTechnician(prisma, dealer.dealershipId, 'Tech 02');
    // The only bay is busy at 10:00; a qualified technician is still free.
    await insertAppointment(
      prisma,
      existingRow(dealer, vehicle, { startTime: TEN, endTime: ELEVEN, technicianId: spareTechnicianId }),
    );

    await expect(book(dealer, TEN, { licensePlate: '30E45678', phone: '0912345678' })).rejects.toThrow(
      BayUnavailableException,
    );

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.vehicle.count()).toBe(1);
  });

  it('T3.14b run() rolls back a customer and vehicle created before a failing appointment insert', async () => {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    await insertAppointment(prisma, existingRow(dealer, vehicle, { startTime: TEN, endTime: ELEVEN }));
    const spareTechnicianId = await insertTechnician(prisma, dealer.dealershipId, 'Tech 02');

    // Rows are created first, then the insert overlaps the seeded bay; the whole unit of work must roll back.
    const work = new PrismaBookingUnitOfWork(prisma).run('30E45678', dealer.dealershipId, async (tx) => {
      const customer = await tx.createCustomer({ name: 'Tran Thi B', phone: '0912345678' });
      const newVehicle = await tx.createVehicle({ customerId: customer.id, licensePlate: '30E45678' });
      return tx.createAppointment({
        customerId: customer.id,
        vehicleId: newVehicle.id,
        dealershipId: dealer.dealershipId,
        serviceTypeId: dealer.serviceTypeId,
        serviceBayId: dealer.bayId,
        technicianId: spareTechnicianId,
        startTime: TEN,
        endTime: ELEVEN,
        status: 'Confirmed',
      });
    });

    await expect(work).rejects.toThrow(BayUnavailableException);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.vehicle.count()).toBe(1);
  });
});

describe('PrismaBookingTransaction.createAppointment — 23P01 mapping (ADR-0001 Layer 2, T3.16)', () => {
  /** Seeds a Confirmed 09:00–10:00 row, plus a second vehicle, bay and technician to vary one resource at a time. */
  async function seedConflict(): Promise<{ existing: AppointmentRow; other: AppointmentRow }> {
    const dealer = await seedDealer();
    const vehicle = await seedVehicle();
    const existing = existingRow(dealer, vehicle);
    await insertAppointment(prisma, existing);
    const otherCustomerId = await insertCustomer(prisma, '0912345678');
    const other: AppointmentRow = {
      ...existing,
      customerId: otherCustomerId,
      vehicleId: await insertVehicle(prisma, otherCustomerId, '30E45678'),
      serviceBayId: await insertServiceBay(prisma, dealer.dealershipId, 'Bay 02'),
      technicianId: await insertTechnician(prisma, dealer.dealershipId, 'Tech 02'),
    };
    return { existing, other };
  }

  const insert = (row: AppointmentRow): Promise<Appointment> =>
    new PrismaBookingTransaction(prisma).createAppointment({ ...row, status: 'Confirmed' });

  it('T3.16a an overlap on the same bay is rethrown as BayUnavailableException', async () => {
    const { existing, other } = await seedConflict();

    await expect(insert({ ...other, serviceBayId: existing.serviceBayId })).rejects.toThrow(BayUnavailableException);
  });

  it('T3.16b an overlap on the same technician is rethrown as TechnicianUnavailableException', async () => {
    const { existing, other } = await seedConflict();

    await expect(insert({ ...other, technicianId: existing.technicianId })).rejects.toThrow(
      TechnicianUnavailableException,
    );
  });

  it('T3.16c an overlap on the same vehicle is rethrown as VehicleUnavailableException', async () => {
    const { existing, other } = await seedConflict();

    await expect(insert({ ...other, vehicleId: existing.vehicleId })).rejects.toThrow(VehicleUnavailableException);
  });
});
