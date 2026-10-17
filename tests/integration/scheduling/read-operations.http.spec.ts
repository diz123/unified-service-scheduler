import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';
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

const server = (): Parameters<typeof request>[0] => app.getHttpServer();
const lookup = (body: Record<string, unknown>): request.Test =>
  request(server()).post('/appointments/lookup').send(body);

interface Garage {
  dealershipId: string;
  serviceTypeId: string;
  bayId: string;
  technicianId: string;
}

async function seedGarage(name = 'Dealer A'): Promise<Garage> {
  const dealershipId = await insertDealership(prisma, '08:00', '17:00', 'Asia/Ho_Chi_Minh', name);
  return {
    dealershipId,
    serviceTypeId: await insertServiceType(prisma, dealershipId, 60, 'Oil change'),
    bayId: await insertServiceBay(prisma, dealershipId, 'Bay 01'),
    technicianId: await insertTechnician(prisma, dealershipId, 'Tech 01'),
  };
}

async function seedVehicle(plate: string, phone: string): Promise<{ customerId: string; vehicleId: string }> {
  const customerId = await insertCustomer(prisma, phone);
  return { customerId, vehicleId: await insertVehicle(prisma, customerId, plate) };
}

function row(
  garage: Garage,
  vehicle: { customerId: string; vehicleId: string },
  startTime: string,
  endTime: string,
  status: AppointmentRow['status'] = 'Confirmed',
): AppointmentRow {
  return {
    ...vehicle,
    dealershipId: garage.dealershipId,
    serviceTypeId: garage.serviceTypeId,
    serviceBayId: garage.bayId,
    technicianId: garage.technicianId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status,
  };
}

const sortedKeys = (value: object): string[] => Object.keys(value).sort();

describe('GET /dealerships (T5.1, T5.2)', () => {
  it('T5.1 returns every dealership sorted by name with exactly id, name, openTime, closeTime, timezone', async () => {
    await insertDealership(prisma, '08:00', '17:00', 'Asia/Ho_Chi_Minh', 'Dealer B');
    await insertDealership(prisma, '07:30', '18:00', 'Asia/Ho_Chi_Minh', 'Dealer A');
    await insertDealership(prisma, '09:00', '16:00', 'Asia/Ho_Chi_Minh', 'Dealer C');

    const response = await request(server()).get('/dealerships');

    expect(response.status).toBe(200);
    expect(response.body.map((d: { name: string }) => d.name)).toStrictEqual(['Dealer A', 'Dealer B', 'Dealer C']);
    for (const dealership of response.body) {
      expect(sortedKeys(dealership)).toStrictEqual(['closeTime', 'id', 'name', 'openTime', 'timezone']);
    }
    expect(response.body[0]).toMatchObject({ openTime: '07:30', closeTime: '18:00', timezone: 'Asia/Ho_Chi_Minh' });
  });

  it('T5.2 returns an empty array when there are no dealerships', async () => {
    const response = await request(server()).get('/dealerships');

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });
});

describe('GET /dealerships/:dealershipId/service-types (T5.3, T5.4)', () => {
  it("T5.3 returns only that dealership's service types sorted by name with exactly id, name, durationMinutes", async () => {
    const dealerA = await insertDealership(prisma, '08:00', '17:00', 'Asia/Ho_Chi_Minh', 'Dealer A');
    const dealerB = await insertDealership(prisma, '08:00', '17:00', 'Asia/Ho_Chi_Minh', 'Dealer B');
    await insertServiceType(prisma, dealerA, 45, 'Tire rotation');
    await insertServiceType(prisma, dealerA, 60, 'Oil change');
    await insertServiceType(prisma, dealerB, 90, 'Brake check');

    const response = await request(server()).get(`/dealerships/${dealerA}/service-types`);

    expect(response.status).toBe(200);
    expect(response.body.map((s: { name: string }) => s.name)).toStrictEqual(['Oil change', 'Tire rotation']);
    for (const serviceType of response.body) {
      expect(sortedKeys(serviceType)).toStrictEqual(['durationMinutes', 'id', 'name']);
    }
    expect(response.body[0].durationMinutes).toBe(60);
  });

  it('T5.4 an unknown dealership → 404 DEALERSHIP_NOT_FOUND', async () => {
    const response = await request(server()).get('/dealerships/unknown-dealership/service-types');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('DEALERSHIP_NOT_FOUND');
  });
});

describe('POST /appointments/lookup (T5.5–T5.12)', () => {
  it('T5.5 returns the vehicle\'s appointments in every status, newest startTime first, with only the public fields', async () => {
    const garage = await seedGarage('Dealer A');
    const vehicle = await seedVehicle('51A12345', '0901234567');
    // Local UTC+7: 2030-01-10, 2030-01-12 (Cancelled), 2030-01-14, each 09:00–10:00
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z'));
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-12T02:00:00Z', '2030-01-12T03:00:00Z', 'Cancelled'));
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-14T02:00:00Z', '2030-01-14T03:00:00Z'));

    const response = await lookup({ licensePlate: '51A12345', phone: '0901234567' });

    expect(response.status).toBe(200);
    expect(response.body.map((a: { startTime: string; status: string }) => [a.startTime, a.status])).toStrictEqual([
      ['2030-01-14T02:00:00.000Z', 'Confirmed'],
      ['2030-01-12T02:00:00.000Z', 'Cancelled'],
      ['2030-01-10T02:00:00.000Z', 'Confirmed'],
    ]);
    for (const appointment of response.body) {
      expect(sortedKeys(appointment)).toStrictEqual(['dealership', 'endTime', 'id', 'serviceType', 'startTime', 'status']);
      expect(appointment.dealership).toStrictEqual({ id: garage.dealershipId, name: 'Dealer A' });
      expect(appointment.serviceType).toStrictEqual({ id: garage.serviceTypeId, name: 'Oil change' });
    }
  });

  it('T5.6 normalizes the plate like Book Appointment', async () => {
    const garage = await seedGarage();
    const vehicle = await seedVehicle('51A12345', '0901234567');
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z'));

    const response = await lookup({ licensePlate: '51a-123.45', phone: '0901234567' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('T5.11 compares phones like Book Appointment, with spaces removed', async () => {
    const garage = await seedGarage();
    const vehicle = await seedVehicle('51A12345', '0901234567');
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z'));

    const response = await lookup({ licensePlate: '51A12345', phone: '090 123 4567' });

    expect(response.status).toBe(200);
    expect(response.body.map((a: { startTime: string }) => a.startTime)).toStrictEqual(['2030-01-10T02:00:00.000Z']);
  });

  it('T5.12 a phone booked with spaces is found by a lookup without spaces', async () => {
    const garage = await seedGarage();
    // 10:00 local (UTC+7); booking stores the phone exactly as entered.
    const booked = await request(server()).post('/appointments').send({
      name: 'Nguyen Van A',
      phone: '090 123 4567',
      licensePlate: '51A12345',
      dealershipId: garage.dealershipId,
      serviceTypeId: garage.serviceTypeId,
      startTime: '2030-01-15T03:00:00Z',
    });
    expect(booked.status).toBe(201);

    const response = await lookup({ licensePlate: '51A12345', phone: '0901234567' });

    expect(response.status).toBe(200);
    expect(response.body.map((a: { id: string }) => a.id)).toStrictEqual([booked.body.id]);
  });

  it("T5.7 never returns another vehicle's appointments", async () => {
    const garage = await seedGarage();
    const mine = await seedVehicle('51A12345', '0901234567');
    // Same phone as `mine`: only the vehicle (not the customer's phone) may scope the lookup.
    const other = await seedVehicle('30E45678', '0901234567');
    await insertAppointment(prisma, row(garage, mine, '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z'));
    await insertAppointment(prisma, row(garage, other, '2030-01-11T02:00:00Z', '2030-01-11T03:00:00Z'));

    const response = await lookup({ licensePlate: '51A12345', phone: '0901234567' });

    expect(response.status).toBe(200);
    expect(response.body.map((a: { startTime: string }) => a.startTime)).toStrictEqual(['2030-01-10T02:00:00.000Z']);
  });

  it('T5.8 an unknown plate → 404 APPOINTMENTS_NOT_FOUND', async () => {
    const response = await lookup({ licensePlate: '99Z99999', phone: '0901234567' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('APPOINTMENTS_NOT_FOUND');
  });

  it("T5.9 a known plate with a different phone → 404 with a body identical to T5.8's", async () => {
    const garage = await seedGarage();
    const vehicle = await seedVehicle('51A12345', '0901234567');
    await insertAppointment(prisma, row(garage, vehicle, '2030-01-10T02:00:00Z', '2030-01-10T03:00:00Z'));

    const unknownPlate = await lookup({ licensePlate: '99Z99999', phone: '0999999999' });
    const wrongPhone = await lookup({ licensePlate: '51A12345', phone: '0999999999' });

    expect(wrongPhone.status).toBe(404);
    expect(wrongPhone.body.code).toBe('APPOINTMENTS_NOT_FOUND');
    expect(wrongPhone.body).toStrictEqual(unknownPlate.body);
  });

  it('T5.10a a body missing phone → 400 VALIDATION_FAILED with details', async () => {
    const response = await lookup({ licensePlate: '51A12345' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('T5.10b a blank licensePlate → 400 VALIDATION_FAILED with details', async () => {
    const response = await lookup({ licensePlate: '   ', phone: '0901234567' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.details.length).toBeGreaterThan(0);
  });
});
