import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { format } from 'node:util';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { BookingUnitOfWork } from '../../../src/modules/scheduling/application/ports/booking-unit-of-work.port';
import { BOOKING_UNIT_OF_WORK } from '../../../src/modules/scheduling/scheduling.tokens';
import { DATABASE_PING, DatabasePing } from '../../../src/shared/infrastructure/database/database-ping';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createAppLogger } from '../../../src/shared/infrastructure/logging/app-logger';
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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 10:00–11:00 local (UTC+7) on 2030-01-15
const TEN = '2030-01-15T03:00:00Z';
const ELEVEN = '2030-01-15T04:00:00Z';

const NAME = 'Nguyen Van A';
const PHONE = '0901234567';
const PLATE = '51A-123.45';
const NORMALIZED_PLATE = '51A12345';
const PERSONAL_DATA = [PHONE, PLATE, NORMALIZED_PLATE, NAME];

interface Dealer {
  dealershipId: string;
  serviceTypeId: string;
  bayId: string;
  technicianId: string;
}

async function seedDealer(): Promise<Dealer> {
  const dealershipId = await insertDealership(prisma);
  return {
    dealershipId,
    serviceTypeId: await insertServiceType(prisma, dealershipId),
    bayId: await insertServiceBay(prisma, dealershipId, 'Bay 01'),
    technicianId: await insertTechnician(prisma, dealershipId, 'Tech 01', 'Maintenance'),
  };
}

const bookingBody = (dealer: Dealer): Record<string, unknown> => ({
  name: NAME,
  phone: PHONE,
  licensePlate: PLATE,
  dealershipId: dealer.dealershipId,
  serviceTypeId: dealer.serviceTypeId,
  startTime: TEN,
});

interface AppOverrides {
  unitOfWork?: BookingUnitOfWork;
  ping?: DatabasePing;
}

async function createApp(overrides: AppOverrides = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrides.unitOfWork) {
    builder.overrideProvider(BOOKING_UNIT_OF_WORK).useValue(overrides.unitOfWork);
  }
  if (overrides.ping) {
    builder.overrideProvider(DATABASE_PING).useValue(overrides.ping);
  }
  const app = (await builder.compile()).createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

const LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;
type Level = (typeof LEVELS)[number];

interface LogCall {
  level: Level;
  args: unknown[];
}

interface AccessEntry {
  level: Level;
  entry: Record<string, unknown>;
}

/** Every call made through a Nest `Logger` instance; the spies also keep the test output clean. */
let logCalls: LogCall[] = [];
let spies: jest.SpyInstance[] = [];

const isAccessEntry = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && 'requestId' in value;

const accessEntries = (): AccessEntry[] =>
  logCalls.flatMap((call) => (isAccessEntry(call.args[0]) ? [{ level: call.level, entry: call.args[0] }] : []));

const entryFor = (requestId: unknown): AccessEntry | undefined =>
  accessEntries().find(({ entry }) => entry['requestId'] === requestId);

/** Each argument as Node prints it; unlike JSON.stringify, an Error keeps its message and stack. */
const renderArgs = (args: unknown[]): string => args.map((arg) => format(arg)).join(' ');

/** Personal data found in the Logger calls or in `output` (stdout and stderr writes, console calls). */
const personalDataLogged = (output: string): string[] => {
  const logged = logCalls.map((call) => renderArgs(call.args)).join('\n') + output;
  return PERSONAL_DATA.filter((value) => logged.includes(value));
};

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/**
 * Runs `work` while capturing every write to process.stdout and process.stderr and every console call.
 * Jest buffers console output outside process.stdout, so console calls are captured separately.
 */
async function capturingOutput<T>(work: () => Promise<T>): Promise<{ result: T; output: string }> {
  const written: string[] = [];
  const capture = ((chunk: unknown): boolean => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  const consoleArgs: unknown[][] = [];
  const restorers: jest.SpyInstance[] = [
    jest.spyOn(process.stdout, 'write').mockImplementation(capture),
    jest.spyOn(process.stderr, 'write').mockImplementation(capture),
    ...CONSOLE_METHODS.map((method) =>
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleArgs.push(args);
      }),
    ),
  ];
  try {
    const result = await work();
    return { result, output: written.join('') + consoleArgs.map(renderArgs).join('\n') };
  } finally {
    restorers.forEach((spy) => spy.mockRestore());
  }
}

/** The access log is written when the response finishes; let that event run before reading entries. */
const finished = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

type Server = Parameters<typeof request>[0];

let app: INestApplication;
const server = (): Server => app.getHttpServer() as Server;

beforeAll(async () => {
  app = await createApp();
});

beforeEach(async () => {
  await truncateAll(prisma);
  logCalls = [];
  spies = LEVELS.map((level) =>
    jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      logCalls.push({ level, args });
    }),
  );
});

afterEach(() => {
  spies.forEach((spy) => spy.mockRestore());
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('X-Request-Id on every response (O-2, T8.9)', () => {
  it('T8.9a a 201 booking carries a generated X-Request-Id', async () => {
    const dealer = await seedDealer();

    const response = await request(server()).post('/appointments').send(bookingBody(dealer));

    expect([response.status, UUID_V4.test(String(response.headers['x-request-id']))]).toStrictEqual([201, true]);
  });

  it('T8.9b a 400 validation error carries a generated X-Request-Id', async () => {
    const response = await request(server()).post('/appointments').send({});

    expect([response.status, UUID_V4.test(String(response.headers['x-request-id']))]).toStrictEqual([400, true]);
  });

  it('T8.9c a 404 unknown route carries a generated X-Request-Id', async () => {
    const response = await request(server()).get('/no-such-route');

    expect([response.status, UUID_V4.test(String(response.headers['x-request-id']))]).toStrictEqual([404, true]);
  });
});

describe('Incoming X-Request-Id (O-2, T8.10)', () => {
  it('T8.10a a valid incoming X-Request-Id is echoed unchanged', async () => {
    const incoming = 'client-req.42_abc';

    const response = await request(server()).get('/dealerships').set('X-Request-Id', incoming);

    expect(response.headers['x-request-id']).toBe(incoming);
  });

  it('T8.10b an invalid incoming X-Request-Id is replaced by a new UUID v4', async () => {
    const incoming = 'not valid id';

    const response = await request(server()).get('/dealerships').set('X-Request-Id', incoming);

    const id = String(response.headers['x-request-id']);
    expect([UUID_V4.test(id), id === incoming]).toStrictEqual([true, false]);
  });
});

describe('Access log (O-3, T8.11–T8.14)', () => {
  it('T8.11 exactly one access-log entry per request, with the response requestId and status', async () => {
    const response = await request(server()).get('/dealerships');
    await finished();

    const entries = accessEntries().map(({ entry }) => [entry['requestId'], entry['statusCode']]);
    expect(entries).toStrictEqual([[response.headers['x-request-id'], response.status]]);
  });

  it('T8.12a a 409 BAY_UNAVAILABLE booking produces an entry with code BAY_UNAVAILABLE', async () => {
    const dealer = await seedDealer();
    const customerId = await insertCustomer(prisma, '0907654321');
    const vehicleId = await insertVehicle(prisma, customerId, '59B99999');
    await insertAppointment(prisma, {
      customerId,
      vehicleId,
      dealershipId: dealer.dealershipId,
      serviceTypeId: dealer.serviceTypeId,
      serviceBayId: dealer.bayId,
      technicianId: dealer.technicianId,
      startTime: new Date(TEN),
      endTime: new Date(ELEVEN),
    });

    const response = await request(server()).post('/appointments').send(bookingBody(dealer));
    await finished();

    const entry = entryFor(response.headers['x-request-id'])?.entry;
    expect([response.status, entry?.['statusCode'], entry?.['code']]).toStrictEqual([409, 409, 'BAY_UNAVAILABLE']);
  });

  it('T8.12b a 404 ROUTE_NOT_FOUND produces an entry with code ROUTE_NOT_FOUND', async () => {
    const response = await request(server()).get('/no-such-route');
    await finished();

    const entry = entryFor(response.headers['x-request-id'])?.entry;
    expect([entry?.['statusCode'], entry?.['code']]).toStrictEqual([404, 'ROUTE_NOT_FOUND']);
  });

  it('T8.13a no log output written during a booking contains its phone, licensePlate or name', async () => {
    const dealer = await seedDealer();

    const { result: response, output } = await capturingOutput(async () => {
      const sent = await request(server()).post('/appointments').send(bookingBody(dealer));
      await finished();
      return sent;
    });

    expect([response.status, accessEntries().length, personalDataLogged(output)]).toStrictEqual([201, 1, []]);
  });

  it('T8.13b no log output written during a lookup contains its phone, licensePlate or name', async () => {
    const dealer = await seedDealer();
    await request(server()).post('/appointments').send(bookingBody(dealer)).expect(201);
    await finished();
    logCalls = [];

    const { result: response, output } = await capturingOutput(async () => {
      const sent = await request(server()).post('/appointments/lookup').send({ licensePlate: PLATE, phone: PHONE });
      await finished();
      return sent;
    });

    expect([response.status, accessEntries().length, personalDataLogged(output)]).toStrictEqual([200, 1, []]);
  });

  it('T8.14 an unexpected error produces an error-level entry with code INTERNAL_ERROR, and the response has X-Request-Id', async () => {
    const dealer = await seedDealer();
    const failing: BookingUnitOfWork = { run: () => Promise.reject(new Error('db exploded: secret detail')) };
    const failingApp = await createApp({ unitOfWork: failing });

    try {
      const response = await request(failingApp.getHttpServer() as Server).post('/appointments').send(bookingBody(dealer));
      await finished();

      const requestId = String(response.headers['x-request-id']);
      const found = entryFor(requestId);
      expect([response.status, UUID_V4.test(requestId), found?.level, found?.entry['code']]).toStrictEqual([
        500,
        true,
        'error',
        'INTERNAL_ERROR',
      ]);
    } finally {
      await failingApp.close();
    }
  });
});

describe('Malformed JSON body (O-2, O-3, T8.17)', () => {
  it('T8.17 returns 400 VALIDATION_FAILED with X-Request-Id, and its access-log entry has code VALIDATION_FAILED', async () => {
    const response = await request(server())
      .post('/appointments')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    await finished();

    const requestId = String(response.headers['x-request-id']);
    expect([response.status, response.body.code, UUID_V4.test(requestId), entryFor(requestId)?.entry['code']]).toStrictEqual([
      400,
      'VALIDATION_FAILED',
      true,
      'VALIDATION_FAILED',
    ]);
  });
});

describe('GET /health (O-4, T8.15, T8.18)', () => {
  it('T8.15 returns 200 with exactly { "status": "ok" } when the database is reachable', async () => {
    const response = await request(server()).get('/health');

    expect([response.status, response.body]).toStrictEqual([200, { status: 'ok' }]);
  });

  it('T8.18 a failing database ping returns 503 with exactly the standard error body, no ping message, and X-Request-Id', async () => {
    const failingApp = await createApp({ ping: () => Promise.reject(new Error('connect ECONNREFUSED secret-host:5432')) });

    try {
      const response = await request(failingApp.getHttpServer() as Server).get('/health');

      const body = response.body as { statusCode?: unknown; code?: unknown; message?: unknown };
      expect([
        response.status,
        Object.keys(body).sort(),
        body.statusCode,
        body.code,
        typeof body.message,
        JSON.stringify(body).includes('ECONNREFUSED'),
        UUID_V4.test(String(response.headers['x-request-id'])),
      ]).toStrictEqual([503, ['code', 'message', 'statusCode'], 503, 'DATABASE_UNAVAILABLE', 'string', false, true]);
    } finally {
      await failingApp.close();
    }
  });
});

describe('No X-Powered-By header (O-2, T8.19)', () => {
  it('T8.19a GET /health omits the X-Powered-By header', async () => {
    const response = await request(server()).get('/health');

    expect([response.status, response.headers['x-powered-by']]).toStrictEqual([200, undefined]);
  });

  it('T8.19b a 404 unknown route omits the X-Powered-By header', async () => {
    const response = await request(server()).get('/no-such-route');

    expect([response.status, response.headers['x-powered-by']]).toStrictEqual([404, undefined]);
  });
});

describe('JSON logs (O-1, T8.16)', () => {
  it('T8.16 the app logger writes one line of valid JSON with the message and its context', () => {
    const written: string[] = [];
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    try {
      createAppLogger().log('observability check', 'ObservabilityTest');
    } finally {
      write.mockRestore();
    }

    const output = written.join('');
    const lines = output.split('\n').filter((line) => line !== '');
    const parsed = JSON.parse(lines[0] ?? 'null') as { message?: unknown; context?: unknown } | null;
    expect([lines.length, output.endsWith('\n'), parsed?.message, parsed?.context]).toStrictEqual([
      1,
      true,
      'observability check',
      'ObservabilityTest',
    ]);
  });
});
