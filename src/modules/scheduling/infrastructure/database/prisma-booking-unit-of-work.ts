import { randomUUID } from 'node:crypto';
import {
  BookingTransaction,
  BookingUnitOfWork,
  ConfirmedAppointmentQuery,
  VehicleWithOwner,
} from '../../application/ports/booking-unit-of-work.port';
import {
  Appointment,
  Customer,
  Dealership,
  ServiceBay,
  ServiceType,
  Technician,
  Vehicle,
} from '../../domain/entities';
import {
  BayUnavailableException,
  TechnicianUnavailableException,
  VehicleUnavailableException,
} from '../../domain/scheduling.exceptions';
import { Prisma, PrismaClient } from '../../../../shared/infrastructure/database/generated/client';

/** ADR-0001 Layer 2: each exclusion constraint maps to the domain exception for its resource. */
const OVERLAP_CONSTRAINTS: ReadonlyArray<[string, new () => Error]> = [
  ['appointment_bay_no_overlap', BayUnavailableException],
  ['appointment_technician_no_overlap', TechnicianUnavailableException],
  ['appointment_vehicle_no_overlap', VehicleUnavailableException],
];

interface DriverAdapterCause {
  originalCode?: string;
  originalMessage?: string;
}

const toOverlapException = (error: unknown): Error | undefined => {
  const cause = (error as { meta?: { driverAdapterError?: { cause?: DriverAdapterCause } } }).meta?.driverAdapterError
    ?.cause;
  if (cause?.originalCode !== '23P01') {
    return undefined;
  }
  const match = OVERLAP_CONSTRAINTS.find(([name]) => cause.originalMessage?.includes(name));
  return match ? new match[1]() : undefined;
};

const toVehicle = (row: { id: string; customerId: string; licensePlate: string; make: string | null; model: string | null }): Vehicle => ({
  id: row.id,
  customerId: row.customerId,
  licensePlate: row.licensePlate,
  make: row.make ?? undefined,
  model: row.model ?? undefined,
});

export class PrismaBookingTransaction implements BookingTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  findDealership(id: string): Promise<Dealership | null> {
    return this.tx.dealership.findUnique({ where: { id } });
  }

  findServiceType(id: string): Promise<ServiceType | null> {
    return this.tx.serviceType.findUnique({ where: { id } });
  }

  async findVehicleByPlate(normalizedPlate: string): Promise<VehicleWithOwner | null> {
    const row = await this.tx.vehicle.findUnique({ where: { licensePlate: normalizedPlate }, include: { customer: true } });
    return row ? { vehicle: toVehicle(row), owner: row.customer } : null;
  }

  listServiceBays(dealershipId: string): Promise<ServiceBay[]> {
    return this.tx.serviceBay.findMany({ where: { dealershipId } });
  }

  listTechnicians(dealershipId: string): Promise<Technician[]> {
    return this.tx.technician.findMany({ where: { dealershipId } });
  }

  findConfirmedAppointments(query: ConfirmedAppointmentQuery): Promise<Appointment[]> {
    // Range form matches the partial GiST indexes behind the exclusion constraints.
    const filters = [
      Prisma.sql`"status" = 'Confirmed'`,
      Prisma.sql`tstzrange("startTime", "endTime", '[)') && tstzrange(${query.from}::timestamptz, ${query.to}::timestamptz, '[)')`,
    ];
    if (query.dealershipId !== undefined) {
      filters.push(Prisma.sql`"dealershipId" = ${query.dealershipId}`);
    }
    if (query.vehicleId !== undefined) {
      filters.push(Prisma.sql`"vehicleId" = ${query.vehicleId}`);
    }
    return this.tx.$queryRaw<Appointment[]>`
      SELECT "id", "customerId", "vehicleId", "dealershipId", "serviceTypeId", "serviceBayId", "technicianId",
             "startTime", "endTime", "status"::text AS "status"
      FROM "Appointment"
      WHERE ${Prisma.join(filters, ' AND ')}`;
  }

  createCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
    return this.tx.customer.create({ data });
  }

  async createVehicle(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    return toVehicle(await this.tx.vehicle.create({ data }));
  }

  async createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
    // Raw insert so a constraint violation surfaces as a driver-adapter error with the constraint name.
    const appointment = { ...data, id: randomUUID() };
    try {
      await this.tx.$executeRaw`
        INSERT INTO "Appointment" (
          "id", "customerId", "vehicleId", "dealershipId", "serviceTypeId", "serviceBayId", "technicianId",
          "startTime", "endTime", "status"
        ) VALUES (
          ${appointment.id}, ${data.customerId}, ${data.vehicleId}, ${data.dealershipId}, ${data.serviceTypeId},
          ${data.serviceBayId}, ${data.technicianId}, ${data.startTime}, ${data.endTime},
          ${data.status}::"AppointmentStatus"
        )`;
    } catch (error) {
      throw toOverlapException(error) ?? error;
    }
    return appointment;
  }
}

export class PrismaBookingUnitOfWork implements BookingUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(_normalizedPlate: string, _dealershipId: string, work: (tx: BookingTransaction) => Promise<T>): Promise<T> {
    // Layer 1 locks (plate advisory lock, then Dealership FOR UPDATE) are added with the Round 3c concurrency tests.
    return this.prisma.$transaction((tx) => work(new PrismaBookingTransaction(tx)));
  }
}
