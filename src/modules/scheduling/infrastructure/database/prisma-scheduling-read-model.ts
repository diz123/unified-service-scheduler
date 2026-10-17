import {
  AppointmentSummary,
  DealershipSummary,
  SchedulingReadModel,
  ServiceTypeSummary,
} from '../../application/ports/scheduling-read-model.port';
import { PrismaClient } from '../../../../shared/infrastructure/database/generated/client';

export class PrismaSchedulingReadModel implements SchedulingReadModel {
  constructor(private readonly prisma: PrismaClient) {}

  listDealerships(): Promise<DealershipSummary[]> {
    return this.prisma.dealership.findMany({
      select: { id: true, name: true, openTime: true, closeTime: true, timezone: true },
      orderBy: { name: 'asc' },
    });
  }

  async listServiceTypes(dealershipId: string): Promise<ServiceTypeSummary[] | null> {
    const dealership = await this.prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: {
        serviceTypes: { select: { id: true, name: true, durationMinutes: true }, orderBy: { name: 'asc' } },
      },
    });
    return dealership?.serviceTypes ?? null;
  }

  async findVehicleByPlate(normalizedPlate: string): Promise<{ vehicleId: string; ownerPhone: string } | null> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { licensePlate: normalizedPlate },
      select: { id: true, customer: { select: { phone: true } } },
    });
    return vehicle ? { vehicleId: vehicle.id, ownerPhone: vehicle.customer.phone } : null;
  }

  listAppointmentsForVehicle(vehicleId: string): Promise<AppointmentSummary[]> {
    return this.prisma.appointment.findMany({
      where: { vehicleId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        dealership: { select: { id: true, name: true } },
        serviceType: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }
}
