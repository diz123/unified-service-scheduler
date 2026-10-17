import { AppointmentStatus } from '../../domain/entities';

export interface DealershipSummary {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  timezone: string;
}

export interface ServiceTypeSummary {
  id: string;
  name: string;
  durationMinutes: number;
}

export interface AppointmentSummary {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  dealership: { id: string; name: string };
  serviceType: { id: string; name: string };
}

/** Read-only queries for the booking frontend (DESIGN.md, Read-Only Operations). */
export interface SchedulingReadModel {
  /** Sorted by name. */
  listDealerships(): Promise<DealershipSummary[]>;
  /** Sorted by name; null when the dealership does not exist. */
  listServiceTypes(dealershipId: string): Promise<ServiceTypeSummary[] | null>;
  findVehicleByPlate(normalizedPlate: string): Promise<{ vehicleId: string; ownerPhone: string } | null>;
  /** Every status, newest startTime first. */
  listAppointmentsForVehicle(vehicleId: string): Promise<AppointmentSummary[]>;
}
