import { BookAppointmentUseCase } from '../../../src/modules/scheduling/application/book-appointment.use-case';
import { BookAppointmentCommand } from '../../../src/modules/scheduling/application/commands/book-appointment.command';
import {
  Appointment,
  AppointmentStatus,
  Dealership,
  ServiceBay,
  ServiceType,
  Technician,
  Vehicle,
} from '../../../src/modules/scheduling/domain/entities';
import {
  BayUnavailableException,
  TechnicianUnavailableException,
} from '../../../src/modules/scheduling/domain/scheduling.exceptions';
import { InMemoryBookingStore } from './fakes/in-memory-booking-store';

// Asia/Ho_Chi_Minh is UTC+7 (no DST): local 08:00 on 2030-01-15 = 2030-01-15T01:00Z.
const utc = (iso: string): Date => new Date(iso);
const NOW = utc('2030-01-01T00:00:00Z');
const MAINTENANCE = 'Maintenance';

interface SeedAppointment {
  serviceType: ServiceType;
  bay: ServiceBay;
  technician: Technician;
  startTime: string;
  endTime: string;
  vehicle?: Vehicle;
  status?: AppointmentStatus;
}

class World {
  readonly store = new InMemoryBookingStore();
  readonly useCase = new BookAppointmentUseCase(this.store, { now: () => NOW });

  dealership(name = 'Dealership A'): Dealership {
    const dealership = {
      id: this.store.nextId('dealership'),
      name,
      openTime: '08:00',
      closeTime: '17:00',
      timezone: 'Asia/Ho_Chi_Minh',
    };
    this.store.dealerships.push(dealership);
    return dealership;
  }

  serviceType(dealership: Dealership, durationMinutes = 60): ServiceType {
    const serviceType = {
      id: this.store.nextId('service-type'),
      dealershipId: dealership.id,
      name: 'Oil change',
      requiredSkill: MAINTENANCE,
      durationMinutes,
    };
    this.store.serviceTypes.push(serviceType);
    return serviceType;
  }

  bay(dealership: Dealership, name: string): ServiceBay {
    const bay = { id: this.store.nextId('bay'), dealershipId: dealership.id, name };
    this.store.serviceBays.push(bay);
    return bay;
  }

  technician(dealership: Dealership, name: string, skills: string[] = [MAINTENANCE]): Technician {
    const technician = { id: this.store.nextId('technician'), dealershipId: dealership.id, name, skills };
    this.store.technicians.push(technician);
    return technician;
  }

  vehicle(licensePlate: string, phone = '0901234567'): Vehicle {
    const customer = { id: this.store.nextId('customer'), name: 'Existing Owner', phone };
    const vehicle = { id: this.store.nextId('vehicle'), customerId: customer.id, licensePlate };
    this.store.customers.push(customer);
    this.store.vehicles.push(vehicle);
    return vehicle;
  }

  appointment(seed: SeedAppointment): Appointment {
    const vehicle = seed.vehicle ?? this.vehicle(`SEED${this.store.nextId('plate')}`);
    const appointment = {
      id: this.store.nextId('appointment'),
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      dealershipId: seed.serviceType.dealershipId,
      serviceTypeId: seed.serviceType.id,
      serviceBayId: seed.bay.id,
      technicianId: seed.technician.id,
      startTime: utc(seed.startTime),
      endTime: utc(seed.endTime),
      status: seed.status ?? 'Confirmed',
    };
    this.store.appointments.push(appointment);
    return appointment;
  }

  book(
    serviceType: ServiceType,
    startTime: string,
    overrides: Partial<BookAppointmentCommand> = {},
  ): Promise<Appointment> {
    return this.useCase.execute({
      name: 'Nguyen Van A',
      phone: '0901234567',
      licensePlate: `NEW${this.store.nextId('plate')}`,
      dealershipId: serviceType.dealershipId,
      serviceTypeId: serviceType.id,
      startTime: utc(startTime),
      ...overrides,
    });
  }
}

describe('BookAppointmentUseCase — happy path & allocation', () => {
  it('T2.1 a successful booking is Confirmed and links customer, vehicle, dealership, service type, bay and technician', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership, 120);
    const bay = world.bay(dealership, 'Bay 01');
    const technician = world.technician(dealership, 'Tech 01');

    // 09:00 local + 120 min → 11:00 local
    const appointment = await world.book(serviceType, '2030-01-15T02:00:00Z', { licensePlate: '51A-123.45' });

    const vehicle = world.store.vehicles.find((v) => v.licensePlate === '51A12345');
    expect(vehicle).toBeDefined();
    expect(appointment).toEqual({
      id: expect.any(String),
      customerId: vehicle?.customerId,
      vehicleId: vehicle?.id,
      dealershipId: dealership.id,
      serviceTypeId: serviceType.id,
      serviceBayId: bay.id,
      technicianId: technician.id,
      startTime: utc('2030-01-15T02:00:00Z'),
      endTime: utc('2030-01-15T04:00:00Z'),
      status: 'Confirmed',
    });
  });

  it('T2.2 the qualified technician with the fewest appointments on the local date is assigned', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    const bay = world.bay(dealership, 'Bay 01');
    const otherBay = world.bay(dealership, 'Bay 02');
    const unqualified = world.technician(dealership, 'Tech 00', ['Electrical']);
    const techA = world.technician(dealership, 'Tech 01');
    const techB = world.technician(dealership, 'Tech 02');
    // Tech A: 13:00–14:00 and 14:00–15:00 local; Tech B: 13:00–14:00 local
    world.appointment({ serviceType, bay, technician: techA, startTime: '2030-01-15T06:00:00Z', endTime: '2030-01-15T07:00:00Z' });
    world.appointment({ serviceType, bay, technician: techA, startTime: '2030-01-15T07:00:00Z', endTime: '2030-01-15T08:00:00Z' });
    world.appointment({ serviceType, bay: otherBay, technician: techB, startTime: '2030-01-15T06:00:00Z', endTime: '2030-01-15T07:00:00Z' });

    // 09:00 local: every technician is free in the slot
    const appointment = await world.book(serviceType, '2030-01-15T02:00:00Z');

    expect(appointment.technicianId).toBe(techB.id);
    expect(appointment.technicianId).not.toBe(unqualified.id);
  });

  it('T2.3 an overnight appointment from the previous day counts toward the workload of the date it overlaps', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    const otherBay = world.bay(dealership, 'Bay 02');
    const tech01 = world.technician(dealership, 'Tech 01');
    const tech02 = world.technician(dealership, 'Tech 02');
    // Tech 01: 16:00 local on 2030-01-14 → 09:00 local on 2030-01-15
    world.appointment({ serviceType, bay: otherBay, technician: tech01, startTime: '2030-01-14T09:00:00Z', endTime: '2030-01-15T02:00:00Z' });

    // 10:00 local on 2030-01-15: both free; Tech 01 already has 1 appointment on this date
    const appointment = await world.book(serviceType, '2030-01-15T03:00:00Z');

    expect(appointment.technicianId).toBe(tech02.id);
  });

  it('T2.4 a workload tie is broken by technician name ascending', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 02');
    const tech01 = world.technician(dealership, 'Tech 01');

    const appointment = await world.book(serviceType, '2030-01-15T02:00:00Z');

    expect(appointment.technicianId).toBe(tech01.id);
  });

  it('T2.5 bays are assigned by name ascending, skipping busy bays', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    const bay02 = world.bay(dealership, 'Bay 02');
    const bay01 = world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 01');
    world.technician(dealership, 'Tech 02');

    const first = await world.book(serviceType, '2030-01-15T02:00:00Z');
    const second = await world.book(serviceType, '2030-01-15T02:00:00Z');

    expect(first.serviceBayId).toBe(bay01.id);
    expect(second.serviceBayId).toBe(bay02.id);
  });

  it('T2.6 back-to-back bookings on the same bay, technician and vehicle are allowed in both directions', async () => {
    const scenario = async (existingStart: string, existingEnd: string): Promise<void> => {
      const world = new World();
      const dealership = world.dealership();
      const serviceType = world.serviceType(dealership);
      const bay = world.bay(dealership, 'Bay 01');
      const technician = world.technician(dealership, 'Tech 01');
      const vehicle = world.vehicle('51A12345');
      world.appointment({ serviceType, bay, technician, vehicle, startTime: existingStart, endTime: existingEnd });

      // new 10:00–11:00 local
      await expect(world.book(serviceType, '2030-01-15T03:00:00Z', { licensePlate: '51A12345' })).resolves.toMatchObject({
        serviceBayId: bay.id,
        technicianId: technician.id,
        vehicleId: vehicle.id,
      });
    };

    // existing 08:00–10:00 local
    await scenario('2030-01-15T01:00:00Z', '2030-01-15T03:00:00Z');
    // existing 11:00–12:00 local
    await scenario('2030-01-15T04:00:00Z', '2030-01-15T05:00:00Z');
  });

  it('T2.7 an overnight appointment occupies its bay until its endTime the next day', async () => {
    const setup = (): { world: World; serviceType: ServiceType; bay: ServiceBay } => {
      const world = new World();
      const dealership = world.dealership();
      const serviceType = world.serviceType(dealership);
      const bay = world.bay(dealership, 'Bay 01');
      const busyTech = world.technician(dealership, 'Tech 01');
      world.technician(dealership, 'Tech 02');
      // existing 16:00 local on 2030-01-15 → 09:00 local on 2030-01-16
      world.appointment({ serviceType, bay, technician: busyTech, startTime: '2030-01-15T09:00:00Z', endTime: '2030-01-16T02:00:00Z' });
      return { world, serviceType, bay };
    };

    const blocked = setup();
    // new 08:00 local on 2030-01-16
    await expect(blocked.world.book(blocked.serviceType, '2030-01-16T01:00:00Z')).rejects.toThrow(BayUnavailableException);

    const freed = setup();
    // new 09:00 local on 2030-01-16
    await expect(freed.world.book(freed.serviceType, '2030-01-16T02:00:00Z')).resolves.toMatchObject({
      serviceBayId: freed.bay.id,
    });
  });

  it('T2.8 cancelled appointments neither block resources nor count toward workload', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    const bay = world.bay(dealership, 'Bay 01');
    const tech01 = world.technician(dealership, 'Tech 01');
    const tech02 = world.technician(dealership, 'Tech 02');
    const vehicle = world.vehicle('51A12345');
    // Tech 01: 2 Cancelled on the date; one overlaps the requested slot on the same bay and vehicle
    world.appointment({ serviceType, bay, technician: tech01, vehicle, startTime: '2030-01-15T02:00:00Z', endTime: '2030-01-15T03:00:00Z', status: 'Cancelled' });
    world.appointment({ serviceType, bay, technician: tech01, startTime: '2030-01-15T05:00:00Z', endTime: '2030-01-15T06:00:00Z', status: 'Cancelled' });
    // Tech 02: 1 Confirmed on the date, outside the requested slot
    world.appointment({ serviceType, bay, technician: tech02, startTime: '2030-01-15T06:00:00Z', endTime: '2030-01-15T07:00:00Z' });

    // 09:00 local
    const appointment = await world.book(serviceType, '2030-01-15T02:00:00Z', { licensePlate: '51A12345' });

    expect(appointment).toMatchObject({ serviceBayId: bay.id, technicianId: tech01.id, vehicleId: vehicle.id });
  });

  it('T2.9 only resources of the requested dealership are assigned', async () => {
    const setup = (): {
      world: World;
      dealershipA: Dealership;
      serviceTypeA: ServiceType;
      bayA: ServiceBay;
      techA: Technician;
    } => {
      const world = new World();
      const dealershipA = world.dealership('Dealership A');
      const dealershipB = world.dealership('Dealership B');
      const serviceTypeA = world.serviceType(dealershipA);
      world.serviceType(dealershipB);
      const bayA = world.bay(dealershipA, 'Bay 01');
      const techA = world.technician(dealershipA, 'Tech 01');
      // Dealership B has free, qualified resources that sort before A's
      world.bay(dealershipB, 'Bay 00');
      world.technician(dealershipB, 'Tech 00');
      return { world, dealershipA, serviceTypeA, bayA, techA };
    };

    // Dealership A: bay busy, a technician free
    const baysFull = setup();
    const freeTechA = baysFull.world.technician(baysFull.dealershipA, 'Tech 02');
    baysFull.world.appointment({
      serviceType: baysFull.serviceTypeA,
      bay: baysFull.bayA,
      technician: freeTechA,
      startTime: '2030-01-15T02:00:00Z',
      endTime: '2030-01-15T03:00:00Z',
    });
    await expect(baysFull.world.book(baysFull.serviceTypeA, '2030-01-15T02:00:00Z')).rejects.toThrow(
      BayUnavailableException,
    );

    // Dealership A: technician busy, a bay free
    const techsFull = setup();
    const freeBayA = techsFull.world.bay(techsFull.dealershipA, 'Bay 02');
    techsFull.world.appointment({
      serviceType: techsFull.serviceTypeA,
      bay: freeBayA,
      technician: techsFull.techA,
      startTime: '2030-01-15T02:00:00Z',
      endTime: '2030-01-15T03:00:00Z',
    });
    await expect(techsFull.world.book(techsFull.serviceTypeA, '2030-01-15T02:00:00Z')).rejects.toThrow(
      TechnicianUnavailableException,
    );

    // No appointment was created with Dealership B's resources
    expect(baysFull.world.store.appointments).toHaveLength(1);
    expect(techsFull.world.store.appointments).toHaveLength(1);
  });
});
