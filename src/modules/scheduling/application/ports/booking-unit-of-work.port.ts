import {
  Appointment,
  Customer,
  Dealership,
  ServiceBay,
  ServiceType,
  Technician,
  Vehicle,
} from '../../domain/entities';

/** Confirmed appointments whose `[startTime, endTime)` overlaps `[from, to)`. */
export interface ConfirmedAppointmentQuery {
  from: Date;
  to: Date;
  dealershipId?: string;
  vehicleId?: string;
}

export interface VehicleWithOwner {
  vehicle: Vehicle;
  owner: Customer;
}

export interface BookingTransaction {
  findDealership(id: string): Promise<Dealership | null>;
  findServiceType(id: string): Promise<ServiceType | null>;
  findVehicleByPlate(normalizedPlate: string): Promise<VehicleWithOwner | null>;
  listServiceBays(dealershipId: string): Promise<ServiceBay[]>;
  listTechnicians(dealershipId: string): Promise<Technician[]>;
  findConfirmedAppointments(query: ConfirmedAppointmentQuery): Promise<Appointment[]>;
  createCustomer(data: Omit<Customer, 'id'>): Promise<Customer>;
  createVehicle(data: Omit<Vehicle, 'id'>): Promise<Vehicle>;
  createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment>;
}

export interface BookingUnitOfWork {
  /** Runs `work` in one transaction holding the plate lock, then the dealership lock (ADR-0001 Layer 1). */
  run<T>(normalizedPlate: string, dealershipId: string, work: (tx: BookingTransaction) => Promise<T>): Promise<T>;
}
