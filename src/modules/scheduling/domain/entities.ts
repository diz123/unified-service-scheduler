export type AppointmentStatus = 'Confirmed' | 'Cancelled';

export interface Dealership {
  id: string;
  name: string;
  /** Local time `HH:mm`. */
  openTime: string;
  /** Local time `HH:mm`. */
  closeTime: string;
  /** IANA timezone identifier. */
  timezone: string;
}

export interface ServiceType {
  id: string;
  dealershipId: string;
  name: string;
  requiredSkill: string;
  durationMinutes: number;
}

export interface ServiceBay {
  id: string;
  dealershipId: string;
  name: string;
}

export interface Technician {
  id: string;
  dealershipId: string;
  name: string;
  skills: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  /** Normalized license plate. */
  licensePlate: string;
  make?: string;
  model?: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  vehicleId: string;
  dealershipId: string;
  serviceTypeId: string;
  serviceBayId: string;
  technicianId: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
}
