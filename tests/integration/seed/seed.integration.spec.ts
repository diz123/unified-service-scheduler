import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { seed } from '../../../prisma/seed';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';
import { createTestPrisma, truncateAll } from '../support/database';

const prisma: PrismaClient = createTestPrisma();
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const BEN_THANH = 'Ben Thanh Service Center';
const THU_DUC = 'Thu Duc Service Center';
const PHU_MY_HUNG = 'Phu My Hung Service Center';
const TAN_BINH = 'Tan Binh Service Center';
const GO_VAP = 'Go Vap EV Center';

type ServiceTypeRow = [name: string, durationMinutes: number, requiredSkill: string];

/** Round 6b seed data table, sorted by dealership name; service types sorted by name. */
const EXPECTED_DEALERSHIPS: {
  name: string;
  openTime: string;
  closeTime: string;
  bays: number;
  technicians: number;
  serviceTypes: ServiceTypeRow[];
}[] = [
  {
    name: BEN_THANH,
    openTime: '08:00',
    closeTime: '17:00',
    bays: 4,
    technicians: 6,
    serviceTypes: [
      ['Brake inspection', 90, 'Brakes & Suspension'],
      ['EV battery check', 120, 'EV Charging'],
      ['Oil change', 60, 'Maintenance'],
    ],
  },
  {
    name: GO_VAP,
    openTime: '09:00',
    closeTime: '18:00',
    bays: 6,
    technicians: 4,
    serviceTypes: [
      ['Brake inspection', 90, 'Brakes & Suspension'],
      ['EV battery check', 120, 'EV Charging'],
      ['EV software update', 60, 'Electrical'],
    ],
  },
  {
    name: PHU_MY_HUNG,
    openTime: '08:00',
    closeTime: '17:30',
    bays: 8,
    technicians: 14,
    serviceTypes: [
      ['AC service', 120, 'Air Conditioning'],
      ['Full inspection', 240, 'Inspection'],
      ['Oil change', 60, 'Maintenance'],
      ['Tire rotation', 45, 'Tires'],
      ['Transmission repair', 180, 'Transmission'],
    ],
  },
  {
    name: TAN_BINH,
    openTime: '07:00',
    closeTime: '12:00',
    bays: 4,
    technicians: 6,
    serviceTypes: [
      ['Body paint', 300, 'Paint'],
      ['Full inspection', 240, 'Inspection'],
      ['Oil change', 60, 'Maintenance'],
    ],
  },
  {
    name: THU_DUC,
    openTime: '07:30',
    closeTime: '19:00',
    bays: 5,
    technicians: 8,
    serviceTypes: [
      ['Brake inspection', 90, 'Brakes & Suspension'],
      ['EV battery check', 120, 'EV Charging'],
      ['Oil change', 60, 'Maintenance'],
    ],
  },
];

/** Round 6 rows that Round 6b must keep unchanged (T6.6). */
const BEN_THANH_ID = '00000000-0000-4000-8000-000000000001';
const THU_DUC_ID = '00000000-0000-4000-8000-000000000002';
const ROUND_6 = {
  dealerships: [
    { id: BEN_THANH_ID, name: BEN_THANH, openTime: '08:00', closeTime: '17:00', timezone: TIMEZONE },
    { id: THU_DUC_ID, name: THU_DUC, openTime: '07:30', closeTime: '19:00', timezone: TIMEZONE },
  ],
  serviceTypes: [
    { id: '00000000-0000-4000-8000-000000000101', dealershipId: BEN_THANH_ID, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
    { id: '00000000-0000-4000-8000-000000000102', dealershipId: BEN_THANH_ID, name: 'Brake inspection', requiredSkill: 'Brakes & Suspension', durationMinutes: 90 },
    { id: '00000000-0000-4000-8000-000000000103', dealershipId: BEN_THANH_ID, name: 'EV battery check', requiredSkill: 'EV Charging', durationMinutes: 120 },
    { id: '00000000-0000-4000-8000-000000000201', dealershipId: THU_DUC_ID, name: 'Oil change', requiredSkill: 'Maintenance', durationMinutes: 60 },
    { id: '00000000-0000-4000-8000-000000000202', dealershipId: THU_DUC_ID, name: 'EV battery check', requiredSkill: 'EV Charging', durationMinutes: 120 },
    { id: '00000000-0000-4000-8000-000000000203', dealershipId: THU_DUC_ID, name: 'Brake inspection', requiredSkill: 'Brakes & Suspension', durationMinutes: 90 },
  ],
  serviceBays: [
    { id: '00000000-0000-4000-8000-000000001001', dealershipId: BEN_THANH_ID, name: 'Bay 01' },
    { id: '00000000-0000-4000-8000-000000001002', dealershipId: BEN_THANH_ID, name: 'Bay 02' },
    { id: '00000000-0000-4000-8000-000000001003', dealershipId: BEN_THANH_ID, name: 'Bay 03' },
    { id: '00000000-0000-4000-8000-000000002001', dealershipId: THU_DUC_ID, name: 'Bay 01' },
    { id: '00000000-0000-4000-8000-000000002002', dealershipId: THU_DUC_ID, name: 'Bay 02' },
    { id: '00000000-0000-4000-8000-000000002003', dealershipId: THU_DUC_ID, name: 'Bay 03' },
  ],
  technicians: [
    { id: '00000000-0000-4000-8000-000000001051', dealershipId: BEN_THANH_ID, name: 'Tech 01', skills: ['Maintenance', 'Brakes & Suspension'] },
    { id: '00000000-0000-4000-8000-000000001052', dealershipId: BEN_THANH_ID, name: 'Tech 02', skills: ['Maintenance'] },
    { id: '00000000-0000-4000-8000-000000001053', dealershipId: BEN_THANH_ID, name: 'Tech 03', skills: ['Electrical'] },
    { id: '00000000-0000-4000-8000-000000001054', dealershipId: BEN_THANH_ID, name: 'Tech 04', skills: ['Maintenance', 'Electrical'] },
    { id: '00000000-0000-4000-8000-000000002051', dealershipId: THU_DUC_ID, name: 'Tech 01', skills: ['Maintenance'] },
    { id: '00000000-0000-4000-8000-000000002052', dealershipId: THU_DUC_ID, name: 'Tech 02', skills: ['Maintenance', 'Overhaul'] },
    { id: '00000000-0000-4000-8000-000000002053', dealershipId: THU_DUC_ID, name: 'Tech 03', skills: ['Electrical', 'EV Charging'] },
    { id: '00000000-0000-4000-8000-000000002054', dealershipId: THU_DUC_ID, name: 'Tech 04', skills: ['Maintenance', 'Electrical'] },
  ],
};

/** Skill-coverage rules (T6.7): how many technicians at the dealership hold each skill. */
type Coverage = { skill: string; exactly?: number; atLeast?: number };
const COVERAGE: [dealership: string, rules: Coverage[]][] = [
  [
    BEN_THANH,
    [
      { skill: 'Maintenance', exactly: 5 },
      { skill: 'Brakes & Suspension', exactly: 1 },
      { skill: 'EV Charging', exactly: 0 },
    ],
  ],
  [
    THU_DUC,
    [
      { skill: 'EV Charging', exactly: 1 },
      { skill: 'Brakes & Suspension', exactly: 0 },
    ],
  ],
  [
    PHU_MY_HUNG,
    [
      { skill: 'Maintenance', atLeast: 2 },
      { skill: 'Tires', atLeast: 2 },
      { skill: 'Air Conditioning', atLeast: 2 },
      { skill: 'Inspection', atLeast: 2 },
      { skill: 'Transmission', exactly: 0 },
    ],
  ],
  [
    TAN_BINH,
    [
      { skill: 'Inspection', atLeast: 1 },
      { skill: 'Paint', exactly: 0 },
    ],
  ],
  [
    GO_VAP,
    [
      { skill: 'EV Charging', exactly: 1 },
      { skill: 'Electrical', atLeast: 2 },
      { skill: 'Brakes & Suspension', exactly: 0 },
    ],
  ],
];

/** Every master-data row, ordered by id, with all fields. */
async function masterData(): Promise<unknown> {
  return {
    dealerships: await prisma.dealership.findMany({ orderBy: { id: 'asc' } }),
    serviceTypes: await prisma.serviceType.findMany({ orderBy: { id: 'asc' } }),
    serviceBays: await prisma.serviceBay.findMany({ orderBy: { id: 'asc' } }),
    technicians: await prisma.technician.findMany({ orderBy: { id: 'asc' } }),
  };
}

/** Service types split by whether any technician at the same dealership holds the required skill. */
async function serviceTypesByCoverage(): Promise<{
  covered: { id: string; dealershipId: string }[];
  uncovered: { id: string; dealershipId: string }[];
}> {
  const technicians = await prisma.technician.findMany();
  const serviceTypes = await prisma.serviceType.findMany({ orderBy: { id: 'asc' } });
  const isCovered = (s: { dealershipId: string; requiredSkill: string }): boolean =>
    technicians.some((t) => t.dealershipId === s.dealershipId && t.skills.includes(s.requiredSkill));
  return {
    covered: serviceTypes.filter(isCovered),
    uncovered: serviceTypes.filter((s) => !isCovered(s)),
  };
}

/** The seeded dealership with this name, with its bays, technicians and service types. */
async function dealershipNamed(name: string) {
  const dealership = await prisma.dealership.findFirst({
    where: { name },
    include: { serviceBays: true, technicians: true, serviceTypes: true },
  });
  expect(dealership).not.toBeNull();
  if (dealership === null) throw new Error(`No dealership named ${name}`);
  return dealership;
}

function serviceTypeNamed(dealership: { serviceTypes: { id: string; name: string }[] }, name: string): string {
  const serviceType = dealership.serviceTypes.find((s) => s.name === name);
  expect(serviceType).toBeDefined();
  if (serviceType === undefined) throw new Error(`No service type named ${name}`);
  return serviceType.id;
}

/** 10:00 local (UTC+7) on 2030-01-(10 + day), inside every seeded dealership's hours. */
const tenAmLocal = (day: number): string => `2030-01-${String(10 + day).padStart(2, '0')}T03:00:00Z`;

function book(
  dealershipId: string,
  serviceTypeId: string,
  startTime: string,
  plate: string,
  overnightConsent?: boolean,
): request.Test {
  return request(app.getHttpServer())
    .post('/appointments')
    .send({
      name: 'Nguyen Van A',
      phone: '0901234567',
      licensePlate: plate,
      dealershipId,
      serviceTypeId,
      startTime,
      ...(overnightConsent !== undefined && { overnightConsent }),
    });
}

describe('Seed script (Round 6b)', () => {
  it('T6.1 on an empty database creates exactly the documented master data', async () => {
    await seed(prisma);

    const dealerships = await prisma.dealership.findMany({
      include: { serviceBays: true, technicians: true, serviceTypes: true },
      orderBy: { name: 'asc' },
    });
    expect(
      dealerships.map((d) => ({
        name: d.name,
        openTime: d.openTime,
        closeTime: d.closeTime,
        bays: d.serviceBays.length,
        technicians: d.technicians.length,
        serviceTypes: d.serviceTypes
          .map((s): ServiceTypeRow => [s.name, s.durationMinutes, s.requiredSkill])
          .sort((a, b) => a[0].localeCompare(b[0])),
      })),
    ).toStrictEqual(EXPECTED_DEALERSHIPS);
    expect(new Set(dealerships.map((d) => d.timezone))).toStrictEqual(new Set([TIMEZONE]));
    expect([await prisma.customer.count(), await prisma.vehicle.count(), await prisma.appointment.count()]).toStrictEqual(
      [0, 0, 0],
    );
  });

  it('T6.2 running the seed a second time changes nothing', async () => {
    await seed(prisma);
    const first = await masterData();

    await seed(prisma);

    expect(await masterData()).toStrictEqual(first);
  });

  it('T6.2b ids are fixed: seeding a fresh database twice yields the same ids', async () => {
    await seed(prisma);
    const first = await masterData();

    await truncateAll(prisma);
    await seed(prisma);

    expect(await masterData()).toStrictEqual(first);
  });

  it('T6.3 re-seeding leaves customers, vehicles and appointments unchanged', async () => {
    await seed(prisma);
    const { covered } = await serviceTypesByCoverage();
    const booked = await book(covered[0].dealershipId, covered[0].id, tenAmLocal(0), '51A12345', true);
    expect(booked.status).toBe(201);
    const before = {
      customers: await prisma.customer.findMany(),
      vehicles: await prisma.vehicle.findMany(),
      appointments: await prisma.appointment.findMany(),
    };

    await seed(prisma);

    expect({
      customers: await prisma.customer.findMany(),
      vehicles: await prisma.vehicle.findMany(),
      appointments: await prisma.appointment.findMany(),
    }).toStrictEqual(before);
  });

  it('T6.4 every covered service type at every dealership can be booked (201)', async () => {
    await seed(prisma);
    const { covered } = await serviceTypesByCoverage();
    expect(new Set(covered.map((s) => s.dealershipId)).size).toBe(EXPECTED_DEALERSHIPS.length);

    const statuses = [];
    for (const [i, serviceType] of covered.entries()) {
      const plate = `30E${String(i).padStart(5, '0')}`;
      statuses.push((await book(serviceType.dealershipId, serviceType.id, tenAmLocal(i), plate, true)).status);
    }

    expect(statuses).toStrictEqual(covered.map(() => 201));
  });

  it.each([
    [BEN_THANH, 'EV battery check'],
    [THU_DUC, 'Brake inspection'],
    [PHU_MY_HUNG, 'Transmission repair'],
    [TAN_BINH, 'Body paint'],
    [GO_VAP, 'Brake inspection'],
  ])('T6.5 %s: the uncovered %s is rejected with 422 NO_QUALIFIED_TECHNICIAN', async (name, serviceTypeName) => {
    await seed(prisma);
    const dealership = await dealershipNamed(name);

    const response = await book(dealership.id, serviceTypeNamed(dealership, serviceTypeName), tenAmLocal(0), '51A12345', true);

    expect([response.status, response.body.code]).toStrictEqual([422, 'NO_QUALIFIED_TECHNICIAN']);
  });

  it('T6.6 the Round 6 dealerships, service types, bays and technicians keep their ids and field values', async () => {
    await seed(prisma);
    const byIds = <T extends { id: string }>(rows: T[]) => ({ id: { in: rows.map((r) => r.id) } });

    expect({
      dealerships: await prisma.dealership.findMany({ where: byIds(ROUND_6.dealerships), orderBy: { id: 'asc' } }),
      serviceTypes: await prisma.serviceType.findMany({ where: byIds(ROUND_6.serviceTypes), orderBy: { id: 'asc' } }),
      serviceBays: await prisma.serviceBay.findMany({ where: byIds(ROUND_6.serviceBays), orderBy: { id: 'asc' } }),
      technicians: await prisma.technician.findMany({ where: byIds(ROUND_6.technicians), orderBy: { id: 'asc' } }),
    }).toStrictEqual(ROUND_6);
  });

  it.each(COVERAGE)('T6.7 %s: skill coverage matches the demo rules', async (name, rules) => {
    await seed(prisma);
    const { technicians } = await dealershipNamed(name);
    const holders = (skill: string): number => technicians.filter((t) => t.skills.includes(skill)).length;

    const broken = rules
      .map((rule) => ({ ...rule, holders: holders(rule.skill) }))
      .filter(({ holders: n, exactly, atLeast }) => (exactly !== undefined ? n !== exactly : n < (atLeast ?? 0)));

    expect(broken).toStrictEqual([]);
  });

  it('T6.8 demo no free bay: Ben Thanh Oil change, 5 plates at the same start → 4 × 201 then 409 BAY_UNAVAILABLE', async () => {
    await seed(prisma);
    const dealership = await dealershipNamed(BEN_THANH);
    const oilChange = serviceTypeNamed(dealership, 'Oil change');

    const responses = [];
    for (let i = 0; i < 5; i += 1) {
      responses.push(await book(dealership.id, oilChange, tenAmLocal(0), `51B0000${i}`));
    }

    expect(responses.map((r) => r.status)).toStrictEqual([201, 201, 201, 201, 409]);
    expect(responses[4].body.code).toBe('BAY_UNAVAILABLE');
  });

  it('T6.9 demo no free technician: Go Vap EV battery check, 2 plates at the same start → 201 then 409 TECHNICIAN_UNAVAILABLE', async () => {
    await seed(prisma);
    const dealership = await dealershipNamed(GO_VAP);
    const evBatteryCheck = serviceTypeNamed(dealership, 'EV battery check');

    const first = await book(dealership.id, evBatteryCheck, tenAmLocal(0), '51C00001');
    const second = await book(dealership.id, evBatteryCheck, tenAmLocal(0), '51C00002');

    expect([first.status, second.status, second.body.code]).toStrictEqual([201, 409, 'TECHNICIAN_UNAVAILABLE']);
    expect(dealership.serviceBays.length).toBeGreaterThan(1);
  });

  describe('T6.10 demo overnight: Tan Binh Full inspection at 09:00 local', () => {
    // 2030-01-15 09:00 local (UTC+7); 240 minutes cannot finish before the 12:00 close.
    const nineAm = '2030-01-15T02:00:00Z';

    it('without consent → 400 OVERNIGHT_CONSENT_REQUIRED', async () => {
      await seed(prisma);
      const dealership = await dealershipNamed(TAN_BINH);

      const response = await book(dealership.id, serviceTypeNamed(dealership, 'Full inspection'), nineAm, '51D00001');

      expect([response.status, response.body.code]).toStrictEqual([400, 'OVERNIGHT_CONSENT_REQUIRED']);
    });

    it('with overnightConsent: true → 201 with endTime on the next local day', async () => {
      await seed(prisma);
      const dealership = await dealershipNamed(TAN_BINH);

      const response = await book(dealership.id, serviceTypeNamed(dealership, 'Full inspection'), nineAm, '51D00001', true);

      const localEndDate = new Date(Date.parse(response.body.endTime) + 7 * 60 * 60_000).toISOString().slice(0, 10);
      expect([response.status, localEndDate]).toStrictEqual([201, '2030-01-16']);
    });
  });

  it.each(EXPECTED_DEALERSHIPS.map((d) => [d.name, d.bays, d.technicians] as const))(
    'T6.11 %s: %i bays and %i technicians named Bay 01… and Tech 01…, zero-padded and unique',
    async (name, bays, technicians) => {
      await seed(prisma);
      const dealership = await dealershipNamed(name);
      const numbered = (prefix: string, count: number): string[] =>
        Array.from({ length: count }, (_, i) => `${prefix} ${String(i + 1).padStart(2, '0')}`);

      expect({
        bays: dealership.serviceBays.map((b) => b.name).sort(),
        technicians: dealership.technicians.map((t) => t.name).sort(),
      }).toStrictEqual({ bays: numbered('Bay', bays), technicians: numbered('Tech', technicians) });
    },
  );
});
