import { createHash, randomUUID } from 'node:crypto';
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
  TransactionTimeoutException,
  VehicleUnavailableException,
} from '../../domain/scheduling.exceptions';
import { Prisma, PrismaClient } from '../../../../shared/infrastructure/database/generated/client';

/** Waits are serialised behind the Layer 1 locks, so a transaction may queue behind several others. */
const TRANSACTION_TIMEOUT_MS = 15_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

/** Stable signed 64-bit advisory-lock key for a normalized plate (ADR-0001 Layer 1). */
const plateLockKey = (normalizedPlate: string): bigint =>
  createHash('sha256').update(normalizedPlate).digest().readBigInt64BE(0);

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
    // Overlap (I-2) written with the same tstzrange '[)' form as the exclusion constraints.
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

export interface BookingTransactionLimits {
  timeoutMs?: number;
  maxWaitMs?: number;
}

export class PrismaBookingUnitOfWork implements BookingUnitOfWork {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly limits: BookingTransactionLimits = {},
  ) {}

  async run<T>(normalizedPlate: string, dealershipId: string, work: (tx: BookingTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // ADR-0001 Layer 1, fixed order to rule out deadlocks: plate advisory lock, then the Dealership row.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${plateLockKey(normalizedPlate)})`;
          await tx.$executeRaw`SELECT 1 FROM "Dealership" WHERE "id" = ${dealershipId} FOR UPDATE`;
          return work(new PrismaBookingTransaction(tx));
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: this.limits.timeoutMs ?? TRANSACTION_TIMEOUT_MS,
          maxWait: this.limits.maxWaitMs ?? TRANSACTION_MAX_WAIT_MS,
        },
      );
    } catch (error) {
      // P2028: the interactive transaction timed out or could not start in time (DESIGN.md → 503, retryable).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
        throw new TransactionTimeoutException();
      }
      throw error;
    }
  }
}
