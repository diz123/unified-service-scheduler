import { BookAppointmentUseCase } from '../../../src/modules/scheduling/application/book-appointment.use-case';
import { BookAppointmentCommand } from '../../../src/modules/scheduling/application/commands/book-appointment.command';
import { Appointment } from '../../../src/modules/scheduling/domain/entities';
import {
  BayUnavailableException,
  PlatePhoneMismatchException,
  TechnicianUnavailableException,
  VehicleUnavailableException,
} from '../../../src/modules/scheduling/domain/scheduling.exceptions';
import { PrismaBookingUnitOfWork } from '../../../src/modules/scheduling/infrastructure/database/prisma-booking-unit-of-work';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createTestPrisma, truncateAll } from '../support/database';
import {
  insertCustomer,
  insertDealership,
  insertServiceBay,
  insertServiceType,
  insertTechnician,
  insertVehicle,
} from '../support/seed';

const N = 10;
const prisma: PrismaClient = createTestPrisma();
const useCase = new BookAppointmentUseCase(new PrismaBookingUnitOfWork(prisma), {
  now: () => new Date('2030-01-01T00:00:00Z'),
});

// Local UTC+7 on 2030-01-15
const NINE = new Date('2030-01-15T02:00:00Z');
const TEN = new Date('2030-01-15T03:00:00Z');
const ONE_PM = new Date('2030-01-15T06:00:00Z');
const MINUTE = 60_000;

interface Dealer {
  dealershipId: string;
  serviceTypeId: string;
}

const pad = (i: number): string => String(i + 1).padStart(2, '0');

/** A dealership with `bays` bays and `technicians` qualified technicians, named in zero-padded order. */
async function seedDealer(bays: number, technicians: number, durationMinutes = 60): Promise<Dealer> {
  const dealershipId = await insertDealership(prisma);
  const serviceTypeId = await insertServiceType(prisma, dealershipId, durationMinutes);
  for (let i = 0; i < bays; i += 1) {
    await insertServiceBay(prisma, dealershipId, `Bay ${pad(i)}`);
  }
  for (let i = 0; i < technicians; i += 1) {
    await insertTechnician(prisma, dealershipId, `Tech ${pad(i)}`);
  }
  return { dealershipId, serviceTypeId };
}

function book(dealer: Dealer, startTime: Date, overrides: Partial<BookAppointmentCommand> = {}): Promise<Appointment> {
  return useCase.execute({
    name: 'Nguyen Van A',
    phone: '0901234567',
    licensePlate: '51A12345',
    dealershipId: dealer.dealershipId,
    serviceTypeId: dealer.serviceTypeId,
    startTime,
    ...overrides,
  });
}

/** Distinct new plate and phone per request, so only the resource under test is shared. */
const newPlate = (i: number): Partial<BookAppointmentCommand> => ({
  licensePlate: `30E${String(i).padStart(5, '0')}`,
  phone: `09120000${pad(i)}`,
});

interface Outcome {
  fulfilled: Appointment[];
  rejected: unknown[];
}

async function settle(requests: Promise<Appointment>[]): Promise<Outcome> {
  const results = await Promise.allSettled(requests);
  return {
    fulfilled: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    rejected: results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : [])),
  };
}

/** Every rejection must be the expected domain exception — no raw 23P01/23505/40P01 or timeout. */
function expectOnly(rejected: unknown[], exception: new () => Error, count: number): void {
  expect(rejected).toHaveLength(count);
  for (const reason of rejected) {
    expect(reason).toBeInstanceOf(exception);
  }
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Concurrent bookings for shared resources (I-3)', () => {
  it('T3.5 last-bay race: exactly one of N bookings gets the only bay', async () => {
    const dealer = await seedDealer(1, N);

    const outcome = await settle(Array.from({ length: N }, (_, i) => book(dealer, TEN, newPlate(i))));

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, BayUnavailableException, N - 1);
  });

  it('T3.6 last-technician race: exactly one of N bookings gets the only qualified technician', async () => {
    const dealer = await seedDealer(N, 1);

    const outcome = await settle(Array.from({ length: N }, (_, i) => book(dealer, TEN, newPlate(i))));

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, TechnicianUnavailableException, N - 1);
  });

  it('T3.7 partial-overlap race: staggered bookings that all overlap the only bay yield exactly one success', async () => {
    const dealer = await seedDealer(1, N, 120);
    // 09:00, 09:10, … 10:30 local; each lasts 120 minutes, so every pair overlaps.
    const starts = Array.from({ length: N }, (_, i) => new Date(NINE.getTime() + i * 10 * MINUTE));

    const outcome = await settle(starts.map((start, i) => book(dealer, start, newPlate(i))));

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, BayUnavailableException, N - 1);
  });

  it('T3.8 no false contention: two bookings with two free bays and technicians both succeed on distinct resources', async () => {
    const dealer = await seedDealer(2, 2);

    const outcome = await settle([book(dealer, TEN, newPlate(0)), book(dealer, TEN, newPlate(1))]);

    expect(outcome.rejected).toEqual([]);
    expect(new Set(outcome.fulfilled.map((a) => a.serviceBayId)).size).toBe(2);
    expect(new Set(outcome.fulfilled.map((a) => a.technicianId)).size).toBe(2);
  });
});

describe('Concurrent bookings for the same vehicle (I-10)', () => {
  it('T3.9 the same existing vehicle at one dealership: exactly one of N bookings succeeds', async () => {
    const dealer = await seedDealer(N, N);
    const customerId = await insertCustomer(prisma, '0901234567');
    await insertVehicle(prisma, customerId, '51A12345');

    const outcome = await settle(Array.from({ length: N }, () => book(dealer, TEN)));

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, VehicleUnavailableException, N - 1);
  });

  it('T3.10 the same existing vehicle at two dealerships: one succeeds, one is unavailable, no deadlock', async () => {
    const dealerA = await seedDealer(1, 1);
    const dealerB = await seedDealer(1, 1);
    const customerId = await insertCustomer(prisma, '0901234567');
    await insertVehicle(prisma, customerId, '51A12345');

    const outcome = await settle([book(dealerA, TEN), book(dealerB, TEN)]);

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, VehicleUnavailableException, 1);
  });
});

// Racers book at two different dealerships, so the Dealership row lock cannot serialise them;
// only the plate advisory lock (ADR-0001 Amendment 1) can.
describe('Concurrent first bookings for the same new plate (Customer and vehicle resolution)', () => {
  it('T3.11 same new plate and phone at non-overlapping times: both succeed with one customer and one vehicle', async () => {
    const dealerA = await seedDealer(1, 1);
    const dealerB = await seedDealer(1, 1);

    const outcome = await settle([book(dealerA, TEN), book(dealerB, ONE_PM)]);

    expect(outcome.rejected).toEqual([]);
    expect(outcome.fulfilled).toHaveLength(2);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.vehicle.count()).toBe(1);
  });

  it('T3.12 same new plate and phone at overlapping times: one succeeds, one is unavailable, one vehicle', async () => {
    const dealerA = await seedDealer(1, 1);
    const dealerB = await seedDealer(1, 1);

    const outcome = await settle([book(dealerA, TEN), book(dealerB, TEN)]);

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, VehicleUnavailableException, 1);
    expect(await prisma.vehicle.count()).toBe(1);
  });

  it('T3.13 same new plate with different phones: one succeeds, one is a plate/phone mismatch', async () => {
    const dealerA = await seedDealer(1, 1);
    const dealerB = await seedDealer(1, 1);

    const outcome = await settle([
      book(dealerA, TEN, { phone: '0901234567' }),
      book(dealerB, ONE_PM, { phone: '0987654321' }),
    ]);

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, PlatePhoneMismatchException, 1);
  });

  it('T3.19 two new plates racing for the last bay: one succeeds and only its customer and vehicle remain', async () => {
    const dealer = await seedDealer(1, 2);

    const outcome = await settle([book(dealer, TEN, newPlate(0)), book(dealer, TEN, newPlate(1))]);

    expect(outcome.fulfilled).toHaveLength(1);
    expectOnly(outcome.rejected, BayUnavailableException, 1);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.vehicle.count()).toBe(1);
  });
});
