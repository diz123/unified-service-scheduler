import {
  BookingTransaction,
  BookingUnitOfWork,
  ConfirmedAppointmentQuery,
  VehicleWithOwner,
} from '../../../../src/modules/scheduling/application/ports/booking-unit-of-work.port';
import {
  Appointment,
  Customer,
  Dealership,
  ServiceBay,
  ServiceType,
  Technician,
  Vehicle,
} from '../../../../src/modules/scheduling/domain/entities';

/**
 * Test double for the booking persistence ports. Re-implements overlap and lookup logic
 * in memory; boundary cases are re-verified against PostgreSQL in Round 3.
 */
export class InMemoryBookingStore implements BookingUnitOfWork, BookingTransaction {
  readonly dealerships: Dealership[] = [];
  readonly serviceTypes: ServiceType[] = [];
  readonly serviceBays: ServiceBay[] = [];
  readonly technicians: Technician[] = [];
  readonly customers: Customer[] = [];
  readonly vehicles: Vehicle[] = [];
  readonly appointments: Appointment[] = [];
  private sequence = 0;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  async run<T>(
    _normalizedPlate: string,
    _dealershipId: string,
    work: (tx: BookingTransaction) => Promise<T>,
  ): Promise<T> {
    return work(this);
  }

  async findDealership(id: string): Promise<Dealership | null> {
    return this.dealerships.find((d) => d.id === id) ?? null;
  }

  async findServiceType(id: string): Promise<ServiceType | null> {
    return this.serviceTypes.find((s) => s.id === id) ?? null;
  }

  async findVehicleByPlate(normalizedPlate: string): Promise<VehicleWithOwner | null> {
    const vehicle = this.vehicles.find((v) => v.licensePlate === normalizedPlate);
    const owner = vehicle && this.customers.find((c) => c.id === vehicle.customerId);
    return vehicle && owner ? { vehicle, owner } : null;
  }

  async listServiceBays(dealershipId: string): Promise<ServiceBay[]> {
    return this.serviceBays.filter((b) => b.dealershipId === dealershipId);
  }

  async listTechnicians(dealershipId: string): Promise<Technician[]> {
    return this.technicians.filter((t) => t.dealershipId === dealershipId);
  }

  async findConfirmedAppointments(query: ConfirmedAppointmentQuery): Promise<Appointment[]> {
    return this.appointments.filter(
      (a) =>
        a.status === 'Confirmed' &&
        a.startTime < query.to &&
        a.endTime > query.from &&
        (query.dealershipId === undefined || a.dealershipId === query.dealershipId) &&
        (query.vehicleId === undefined || a.vehicleId === query.vehicleId),
    );
  }

  async createCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
    const customer = { ...data, id: this.nextId('customer') };
    this.customers.push(customer);
    return customer;
  }

  async createVehicle(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const vehicle = { ...data, id: this.nextId('vehicle') };
    this.vehicles.push(vehicle);
    return vehicle;
  }

  async createAppointment(data: Omit<Appointment, 'id'>): Promise<Appointment> {
    const appointment = { ...data, id: this.nextId('appointment') };
    this.appointments.push(appointment);
    return appointment;
  }
}
