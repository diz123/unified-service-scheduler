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

function book(dealershipId: string, serviceTypeId: string, day: number, plate: string): request.Test {
  // 10:00 local (UTC+7) inside both dealerships' hours; consent covers any service that runs past close.
  return request(app.getHttpServer())
    .post('/appointments')
    .send({
      name: 'Nguyen Van A',
      phone: '0901234567',
      licensePlate: plate,
      dealershipId,
      serviceTypeId,
      startTime: `2030-01-${String(10 + day).padStart(2, '0')}T03:00:00Z`,
      overnightConsent: true,
    });
}

describe('Seed script (Round 6)', () => {
  it('T6.1 on an empty database creates exactly the documented master data', async () => {
    await seed(prisma);

    const dealerships = await prisma.dealership.findMany({
      include: { serviceBays: true, technicians: true, serviceTypes: true },
      orderBy: { openTime: 'asc' },
    });
    expect(dealerships.map((d) => [d.openTime, d.closeTime, d.timezone])).toStrictEqual([
      ['07:30', '19:00', 'Asia/Ho_Chi_Minh'],
      ['08:00', '17:00', 'Asia/Ho_Chi_Minh'],
    ]);
    for (const dealership of dealerships) {
      expect([dealership.serviceBays.length, dealership.technicians.length, dealership.serviceTypes.length]).toStrictEqual(
        [3, 4, 3],
      );
    }
    const { uncovered } = await serviceTypesByCoverage();
    expect(uncovered.map((s) => s.dealershipId).sort()).toStrictEqual(dealerships.map((d) => d.id).sort());
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
    const booked = await book(covered[0].dealershipId, covered[0].id, 0, '51A12345');
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

  it('T6.4 every service type whose skill is covered can be booked (201)', async () => {
    await seed(prisma);
    const { covered } = await serviceTypesByCoverage();
    expect(covered.length).toBeGreaterThan(0);

    const statuses = [];
    for (const [i, serviceType] of covered.entries()) {
      statuses.push((await book(serviceType.dealershipId, serviceType.id, i, `30E${String(i).padStart(5, '0')}`)).status);
    }

    expect(statuses).toStrictEqual(covered.map(() => 201));
  });

  it('T6.5 the uncovered service type is rejected with 422 NO_QUALIFIED_TECHNICIAN', async () => {
    await seed(prisma);
    const { uncovered } = await serviceTypesByCoverage();

    const response = await book(uncovered[0].dealershipId, uncovered[0].id, 0, '51A12345');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('NO_QUALIFIED_TECHNICIAN');
  });
});
