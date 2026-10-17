import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../src/shared/infrastructure/database/generated/client';

/** Raw-SQL fixtures. They bypass the application so tests can exercise database constraints directly. */

export async function insertDealership(
  prisma: PrismaClient,
  openTime = '08:00',
  closeTime = '17:00',
  timezone = 'Asia/Ho_Chi_Minh',
): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Dealership" ("id", "name", "openTime", "closeTime", "timezone")
    VALUES (${id}, ${`Dealership ${id}`}, ${openTime}, ${closeTime}, ${timezone})`;
  return id;
}

export async function insertServiceType(
  prisma: PrismaClient,
  dealershipId: string,
  durationMinutes = 60,
): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "ServiceType" ("id", "dealershipId", "name", "requiredSkill", "durationMinutes")
    VALUES (${id}, ${dealershipId}, 'Oil change', 'Maintenance', ${durationMinutes})`;
  return id;
}

export async function insertServiceBay(prisma: PrismaClient, dealershipId: string, name: string): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "ServiceBay" ("id", "dealershipId", "name") VALUES (${id}, ${dealershipId}, ${name})`;
  return id;
}

export async function insertTechnician(prisma: PrismaClient, dealershipId: string, name: string): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Technician" ("id", "dealershipId", "name", "skills")
    VALUES (${id}, ${dealershipId}, ${name}, ARRAY['Maintenance'])`;
  return id;
}

export async function insertCustomer(prisma: PrismaClient, phone = '0901234567'): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "Customer" ("id", "name", "phone") VALUES (${id}, 'Owner', ${phone})`;
  return id;
}

export async function insertVehicle(prisma: PrismaClient, customerId: string, licensePlate: string): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Vehicle" ("id", "customerId", "licensePlate") VALUES (${id}, ${customerId}, ${licensePlate})`;
  return id;
}

export interface AppointmentRow {
  customerId: string;
  vehicleId: string;
  dealershipId: string;
  serviceTypeId: string;
  serviceBayId: string;
  technicianId: string;
  startTime: Date;
  endTime: Date;
  status?: 'Confirmed' | 'Cancelled';
}

export function insertAppointment(prisma: PrismaClient, row: AppointmentRow): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO "Appointment" (
      "id", "customerId", "vehicleId", "dealershipId", "serviceTypeId", "serviceBayId", "technicianId",
      "startTime", "endTime", "status"
    ) VALUES (
      ${randomUUID()}, ${row.customerId}, ${row.vehicleId}, ${row.dealershipId}, ${row.serviceTypeId},
      ${row.serviceBayId}, ${row.technicianId}, ${row.startTime}, ${row.endTime},
      ${row.status ?? 'Confirmed'}::"AppointmentStatus"
    )`;
}
