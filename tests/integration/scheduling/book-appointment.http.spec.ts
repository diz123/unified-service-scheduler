import { INestApplication, Logger } from '@nestjs/common';
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
    // Identifiers only (DESIGN.md, API Contract → HTTP): exactly these keys, every value a string.
    expect(Object.keys(response.body).sort()).toStrictEqual(
      [
        'id',
        'customerId',
        'vehicleId',
        'dealershipId',
        'serviceTypeId',
        'serviceBayId',
        'technicianId',
        'startTime',
        'endTime',
        'status',
      ].sort(),
    );
    expect(Object.values(response.body).every((value) => typeof value === 'string')).toBe(true);
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
      expect(response.body.code).toBe('SERVICE_BUSY');
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

// DESIGN.md "Error response format": { statusCode, code, message } (+ details for validation only), no class names.
const CLASS_NAME = /[A-Z][A-Za-z]*Exception/;

function expectError(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body.code).toBe(code);
}

describe('POST /appointments — error body shape (T4.9)', () => {
  it('T4.9a a domain error body has exactly statusCode, code and message, and no exception class name', async () => {
    const dealer = await seedDealer();

    const response = await post(bookingBody(dealer, { dealershipId: 'unknown-dealership' }));

    expect(Object.keys(response.body).sort()).toStrictEqual(['code', 'message', 'statusCode']);
    expect(JSON.stringify(response.body)).not.toMatch(CLASS_NAME);
  });

  it('T4.9b a validation error body has exactly statusCode, code, message and details, and no exception class name', async () => {
    const dealer = await seedDealer();

    const response = await post(bookingBody(dealer, { startTime: '2030-01-15T10:00:00+07:00' }));

    expect(Object.keys(response.body).sort()).toStrictEqual(['code', 'details', 'message', 'statusCode']);
    expect(JSON.stringify(response.body)).not.toMatch(CLASS_NAME);
  });
});

describe('POST /appointments — one request per error code (T4.10)', () => {
  it('T4.10 START_TIME_IN_PAST', async () => {
    const dealer = await seedDealer();

    expectError(await post(bookingBody(dealer, { startTime: '2020-01-15T03:00:00Z' })), 400, 'START_TIME_IN_PAST');
  });

  it('T4.10 OUTSIDE_WORKING_HOURS', async () => {
    const dealer = await seedDealer();

    // 17:00 local, at closeTime
    expectError(await post(bookingBody(dealer, { startTime: '2030-01-15T10:00:00Z' })), 400, 'OUTSIDE_WORKING_HOURS');
  });

  it('T4.10 OVERNIGHT_CONSENT_REQUIRED', async () => {
    const dealer = await seedDealer();

    // 16:30 local + 60 min → 08:30 local next day, consent omitted
    expectError(
      await post(bookingBody(dealer, { startTime: '2030-01-15T09:30:00Z' })),
      400,
      'OVERNIGHT_CONSENT_REQUIRED',
    );
  });

  it('T4.10 DEALERSHIP_NOT_FOUND', async () => {
    const dealer = await seedDealer();

    expectError(await post(bookingBody(dealer, { dealershipId: 'unknown-dealership' })), 404, 'DEALERSHIP_NOT_FOUND');
  });

  it('T4.10 SERVICE_TYPE_NOT_FOUND for an unknown service type', async () => {
    const dealer = await seedDealer();

    expectError(
      await post(bookingBody(dealer, { serviceTypeId: 'unknown-service-type' })),
      404,
      'SERVICE_TYPE_NOT_FOUND',
    );
  });

  it('T4.10 SERVICE_TYPE_NOT_FOUND for a service type the dealership does not offer', async () => {
    const dealer = await seedDealer();
    const other = await seedDealer();

    expectError(
      await post(bookingBody(dealer, { serviceTypeId: other.serviceTypeId })),
      404,
      'SERVICE_TYPE_NOT_FOUND',
    );
  });

  it('T4.10 PLATE_PHONE_MISMATCH', async () => {
    const dealer = await seedDealer();
    await insertVehicle(prisma, await insertCustomer(prisma, '0901234567'), '51A12345');

    expectError(await post(bookingBody(dealer, { phone: '0999999999' })), 409, 'PLATE_PHONE_MISMATCH');
  });

  it('T4.10 NO_QUALIFIED_TECHNICIAN', async () => {
    const dealer = await seedDealer('Electrical');

    expectError(await post(bookingBody(dealer)), 422, 'NO_QUALIFIED_TECHNICIAN');
  });

  it('T4.10 VEHICLE_UNAVAILABLE', async () => {
    const dealer = await seedDealer();
    const other = await seedDealer();
    const customerId = await insertCustomer(prisma, '0901234567');
    await insertAppointment(prisma, {
      customerId,
      vehicleId: await insertVehicle(prisma, customerId, '51A12345'),
      dealershipId: other.dealershipId,
      serviceTypeId: other.serviceTypeId,
      serviceBayId: other.bayId,
      technicianId: other.technicianId,
      startTime: new Date(TEN),
      endTime: new Date(ELEVEN),
    });

    expectError(await post(bookingBody(dealer)), 409, 'VEHICLE_UNAVAILABLE');
  });

  it('T4.10 BAY_UNAVAILABLE', async () => {
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

    expectError(await post(bookingBody(dealer)), 409, 'BAY_UNAVAILABLE');
  });

  it('T4.10 TECHNICIAN_UNAVAILABLE', async () => {
    const dealer = await seedDealer();
    const customerId = await insertCustomer(prisma, '0912345678');
    await insertAppointment(prisma, {
      customerId,
      vehicleId: await insertVehicle(prisma, customerId, '30E45678'),
      dealershipId: dealer.dealershipId,
      serviceTypeId: dealer.serviceTypeId,
      serviceBayId: await insertServiceBay(prisma, dealer.dealershipId, 'Bay 02'),
      technicianId: dealer.technicianId,
      startTime: new Date(TEN),
      endTime: new Date(ELEVEN),
    });

    expectError(await post(bookingBody(dealer)), 409, 'TECHNICIAN_UNAVAILABLE');
  });
});

describe('POST /appointments — validation error details (T4.11)', () => {
  it('T4.11 a malformed request → 400 VALIDATION_FAILED with one details entry per invalid field', async () => {
    const dealer = await seedDealer();
    const body = bookingBody(dealer, { startTime: '2030-01-15T10:00:00+07:00' });
    delete body['name'];

    const response = await post(body);

    expectError(response, 400, 'VALIDATION_FAILED');
    expect(response.body.details).toHaveLength(2);
    expect(response.body.details.every((entry: unknown) => typeof entry === 'string')).toBe(true);
  });
});

describe('Errors raised outside the scheduling filter (T4.12–T4.14)', () => {
  it('T4.12 a malformed JSON body → 400 VALIDATION_FAILED with the standard error keys', async () => {
    const response = await request(app.getHttpServer())
      .post('/appointments')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expectError(response, 400, 'VALIDATION_FAILED');
    expect(Object.keys(response.body).sort()).toStrictEqual(['code', 'message', 'statusCode']);
    expect(JSON.stringify(response.body)).not.toMatch(CLASS_NAME);
  });

  it('T4.13 an unknown route → 404 ROUTE_NOT_FOUND with exactly statusCode, code and message', async () => {
    const response = await request(app.getHttpServer()).get('/nope');

    expectError(response, 404, 'ROUTE_NOT_FOUND');
    expect(Object.keys(response.body).sort()).toStrictEqual(['code', 'message', 'statusCode']);
  });

  it('T4.14b an unexpected error is logged server-side with its original message and stack', async () => {
    const dealer = await seedDealer();
    const failing: BookingUnitOfWork = { run: () => Promise.reject(new Error('db exploded: secret detail')) };
    const failingApp = await createApp(failing);
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      await request(failingApp.getHttpServer()).post('/appointments').send(bookingBody(dealer));

      expect(logged).toHaveBeenCalledWith(
        'db exploded: secret detail',
        expect.stringContaining('Error: db exploded: secret detail'),
      );
    } finally {
      logged.mockRestore();
      await failingApp.close();
    }
  });

  it('T4.14 an unexpected error → 500 INTERNAL_ERROR with a generic message and no internals', async () => {
    const dealer = await seedDealer();
    const failing: BookingUnitOfWork = { run: () => Promise.reject(new Error('db exploded: secret detail')) };
    const failingApp = await createApp(failing);

    try {
      const response = await request(failingApp.getHttpServer()).post('/appointments').send(bookingBody(dealer));

      expectError(response, 500, 'INTERNAL_ERROR');
      expect(response.body.message).toBe('Internal server error');
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('db exploded');
      expect(body).not.toContain('secret detail');
      expect(body).not.toMatch(/\bat \S+ \(/);
    } finally {
      await failingApp.close();
    }
  });
});

describe('Other framework errors keep their status (T4.15)', () => {
  it('T4.15 a body larger than the parser limit → 413 REQUEST_REJECTED with exactly statusCode, code and message', async () => {
    // Express's default JSON body limit is 100 kB.
    const oversized = { name: 'x'.repeat(200 * 1024) };

    const response = await request(app.getHttpServer()).post('/appointments').send(oversized);

    expectError(response, 413, 'REQUEST_REJECTED');
    expect(Object.keys(response.body).sort()).toStrictEqual(['code', 'message', 'statusCode']);
  });
});
