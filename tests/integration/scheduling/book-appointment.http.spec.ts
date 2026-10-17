import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { BookingUnitOfWork } from '../../../src/modules/scheduling/application/ports/booking-unit-of-work.port';
import { PrismaBookingUnitOfWork } from '../../../src/modules/scheduling/infrastructure/database/prisma-booking-unit-of-work';
import { BOOKING_UNIT_OF_WORK } from '../../../src/modules/scheduling/scheduling.tokens';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createTestPrisma, truncateAll } from '../support/database';
import {
  insertAppointment,
  insertCustomer,
  insertDealership,
  insertServiceBay,
  insertServiceType,
  insertTechnician,
  insertVehicle,
} from '../support/seed';

const prisma: PrismaClient = createTestPrisma();

// 10:00–11:00 local (UTC+7) on 2030-01-15
const TEN = '2030-01-15T03:00:00Z';
const ELEVEN = '2030-01-15T04:00:00Z';

interface Dealer {
  dealershipId: string;
  serviceTypeId: string;
  bayId: string;
  technicianId: string;
}

async function seedDealer(skill = 'Maintenance'): Promise<Dealer> {
  const dealershipId = await insertDealership(prisma);
  return {
    dealershipId,
    serviceTypeId: await insertServiceType(prisma, dealershipId),
    bayId: await insertServiceBay(prisma, dealershipId, 'Bay 01'),
    technicianId: await insertTechnician(prisma, dealershipId, 'Tech 01', skill),
  };
}

function bookingBody(dealer: Dealer, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Nguyen Van A',
    phone: '0901234567',
    licensePlate: '51A-123.45',
    dealershipId: dealer.dealershipId,
    serviceTypeId: dealer.serviceTypeId,
    startTime: TEN,
    ...overrides,
  };
}

async function createApp(unitOfWork?: BookingUnitOfWork): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (unitOfWork) {
    builder.overrideProvider(BOOKING_UNIT_OF_WORK).useValue(unitOfWork);
  }
  const app = (await builder.compile()).createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

let app: INestApplication;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const post = (body: Record<string, unknown>): request.Test =>
  request(app.getHttpServer()).post('/appointments').send(body);

describe('POST /appointments — success (T4.1)', () => {
  it('T4.1 returns 201 with the confirmed appointment and its assigned bay and technician', async () => {
    const dealer = await seedDealer();

    const response = await post(bookingBody(dealer));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      startTime: '2030-01-15T03:00:00.000Z',
      endTime: '2030-01-15T04:00:00.000Z',
      status: 'Confirmed',
      serviceBayId: dealer.bayId,
      technicianId: dealer.technicianId,
    });
  });
});

describe('POST /appointments — exception → status mapping (T4.5)', () => {
  it('T4.5a a past startTime → 400', async () => {
    const dealer = await seedDealer();

    expect((await post(bookingBody(dealer, { startTime: '2020-01-15T03:00:00Z' }))).status).toBe(400);
  });

  it('T4.5b an unknown dealership → 404', async () => {
    const dealer = await seedDealer();

    expect((await post(bookingBody(dealer, { dealershipId: 'unknown-dealership' }))).status).toBe(404);
  });

  it('T4.5c no technician with the required skill → 422', async () => {
    const dealer = await seedDealer('Electrical');

    expect((await post(bookingBody(dealer))).status).toBe(422);
  });

  it('T4.5d the only bay is busy → 409', async () => {
    const dealer = await seedDealer();
    const customerId = await insertCustomer(prisma, '0912345678');
    await insertAppointment(prisma, {
      customerId,
      vehicleId: await insertVehicle(prisma, customerId, '30E45678'),
      dealershipId: dealer.dealershipId,
      serviceTypeId: dealer.serviceTypeId,
      serviceBayId: dealer.bayId,
      technicianId: await insertTechnician(prisma, dealer.dealershipId, 'Tech 02'),
      startTime: new Date(TEN),
      endTime: new Date(ELEVEN),
    });

    expect((await post(bookingBody(dealer))).status).toBe(409);
  });

  it('T4.5e an existing plate with a different phone → 409', async () => {
    const dealer = await seedDealer();
    await insertVehicle(prisma, await insertCustomer(prisma, '0901234567'), '51A12345');

    expect((await post(bookingBody(dealer, { phone: '0999999999' }))).status).toBe(409);
  });

  it('T4.5f a malformed startTime (+07:00) → 400, proving the global validation pipe is wired', async () => {
    const dealer = await seedDealer();

    expect((await post(bookingBody(dealer, { startTime: '2030-01-15T10:00:00+07:00' }))).status).toBe(400);
  });
});

describe('POST /appointments — transaction timeout (T4.6)', () => {
  it('T4.6 a Prisma transaction timeout (P2028) → 503, not 500', async () => {
    const dealer = await seedDealer();
    const timeoutApp = await createApp(new PrismaBookingUnitOfWork(prisma, { timeoutMs: 1_000, maxWaitMs: 1_000 }));

    // Hold the Dealership row lock in another transaction so the booking's Layer 1 lock wait outlives its timeout.
    let releaseLock = (): void => undefined;
    const lockReleased = new Promise<void>((resolve) => (releaseLock = resolve));
    let signalLocked = (): void => undefined;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Dealership" WHERE "id" = ${dealer.dealershipId} FOR UPDATE`;
        signalLocked();
        await lockReleased;
      },
      { timeout: 10_000 },
    );
    await locked;
    const releaseTimer = setTimeout(releaseLock, 2_000);

    try {
      const response = await request(timeoutApp.getHttpServer()).post('/appointments').send(bookingBody(dealer));

      expect(response.status).toBe(503);
    } finally {
      clearTimeout(releaseTimer);
      releaseLock();
      await holder;
      await timeoutApp.close();
    }
  }, 15_000);
});

describe('POST /appointments — no implicit type conversion (T4.7)', () => {
  it('T4.7 overnightConsent "false" sent as a string → 400', async () => {
    const dealer = await seedDealer();

    expect((await post(bookingBody(dealer, { overnightConsent: 'false' }))).status).toBe(400);
  });
});
