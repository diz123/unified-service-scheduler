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
  OutsideWorkingHoursException,
  OvernightConsentRequiredException,
  PastStartTimeException,
  PlatePhoneMismatchException,
  ResourceNotFoundException,
  SkillMismatchException,
  TechnicianUnavailableException,
  VehicleUnavailableException,
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

  vehicle(licensePlate: string, phone = '0901234567', details: Pick<Vehicle, 'make' | 'model'> = {}): Vehicle {
    const customer = { id: this.store.nextId('customer'), name: 'Existing Owner', phone };
    const vehicle = { id: this.store.nextId('vehicle'), customerId: customer.id, licensePlate, ...details };
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

describe('BookAppointmentUseCase — customer & vehicle resolution', () => {
  const setup = (): { world: World; serviceType: ServiceType } => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 01');
    return { world, serviceType };
  };
  // 09:00 local
  const SLOT = '2030-01-15T02:00:00Z';

  it('T2.10 a new plate creates the customer and the vehicle, then books', async () => {
    const { world, serviceType } = setup();

    const appointment = await world.book(serviceType, SLOT, {
      name: 'Tran Thi B',
      phone: '0912345678',
      licensePlate: '30e-456.78',
      make: 'Toyota',
      model: 'Vios',
    });

    expect(world.store.customers).toEqual([{ id: appointment.customerId, name: 'Tran Thi B', phone: '0912345678' }]);
    expect(world.store.vehicles).toEqual([
      {
        id: appointment.vehicleId,
        customerId: appointment.customerId,
        licensePlate: '30E45678',
        make: 'Toyota',
        model: 'Vios',
      },
    ]);
    expect(appointment.status).toBe('Confirmed');
  });

  it('T2.11 an existing plate with a matching phone reuses the vehicle and owner without overwriting the name', async () => {
    const { world, serviceType } = setup();
    const vehicle = world.vehicle('51A12345', '0901234567');

    const appointment = await world.book(serviceType, SLOT, {
      name: 'Someone Else',
      phone: '0901234567',
      licensePlate: '51A12345',
    });

    expect(appointment).toMatchObject({ vehicleId: vehicle.id, customerId: vehicle.customerId });
    expect(world.store.customers).toEqual([{ id: vehicle.customerId, name: 'Existing Owner', phone: '0901234567' }]);
    expect(world.store.vehicles).toHaveLength(1);
  });

  it('T2.12 an existing plate with a different phone is rejected and nothing is created or changed', async () => {
    const { world, serviceType } = setup();
    world.vehicle('51A12345', '0901234567');
    const customersBefore = structuredClone(world.store.customers);
    const vehiclesBefore = structuredClone(world.store.vehicles);

    await expect(
      world.book(serviceType, SLOT, { phone: '0999999999', licensePlate: '51A12345' }),
    ).rejects.toThrow(PlatePhoneMismatchException);

    expect(world.store.customers).toEqual(customersBefore);
    expect(world.store.vehicles).toEqual(vehiclesBefore);
    expect(world.store.appointments).toHaveLength(0);
  });

  it('T2.13 the plate lookup uses the normalized plate', async () => {
    const { world, serviceType } = setup();
    const vehicle = world.vehicle('51A12345', '0901234567');

    const appointment = await world.book(serviceType, SLOT, { phone: '0901234567', licensePlate: '51a-123.45' });

    expect(appointment.vehicleId).toBe(vehicle.id);
    expect(world.store.vehicles).toHaveLength(1);
  });

  it('T2.14 an existing plate keeps its stored make and model', async () => {
    const { world, serviceType } = setup();
    const vehicle = world.vehicle('51A12345', '0901234567', { make: 'Toyota', model: 'Vios' });

    await world.book(serviceType, SLOT, {
      phone: '0901234567',
      licensePlate: '51A12345',
      make: 'Honda',
      model: 'City',
    });

    expect(world.store.vehicles).toEqual([{ ...vehicle, make: 'Toyota', model: 'Vios' }]);
  });

  it('T2.15 phones are compared exactly after removing spaces, without country-code normalization', async () => {
    const matching = setup();
    const vehicle = matching.world.vehicle('51A12345', '0901234567');
    await expect(
      matching.world.book(matching.serviceType, SLOT, { phone: '090 123 4567', licensePlate: '51A12345' }),
    ).resolves.toMatchObject({ vehicleId: vehicle.id });

    const countryCode = setup();
    countryCode.world.vehicle('51A12345', '0901234567');
    await expect(
      countryCode.world.book(countryCode.serviceType, SLOT, { phone: '+84901234567', licensePlate: '51A12345' }),
    ).rejects.toThrow(PlatePhoneMismatchException);
  });
});

describe('BookAppointmentUseCase — rejections', () => {
  // 09:00–10:00 local on 2030-01-15
  const SLOT = '2030-01-15T02:00:00Z';
  const SLOT_END = '2030-01-15T03:00:00Z';

  it('T2.16 an unknown dealership, unknown service type, or service type of another dealership is not found', async () => {
    const world = new World();
    const dealershipA = world.dealership('Dealership A');
    const dealershipB = world.dealership('Dealership B');
    const serviceTypeA = world.serviceType(dealershipA);
    const serviceTypeB = world.serviceType(dealershipB);
    world.bay(dealershipA, 'Bay 01');
    world.technician(dealershipA, 'Tech 01');

    await expect(world.book(serviceTypeA, SLOT, { dealershipId: 'unknown-dealership' })).rejects.toThrow(
      ResourceNotFoundException,
    );
    await expect(world.book(serviceTypeA, SLOT, { serviceTypeId: 'unknown-service-type' })).rejects.toThrow(
      ResourceNotFoundException,
    );
    await expect(world.book(serviceTypeB, SLOT, { dealershipId: dealershipA.id })).rejects.toThrow(
      ResourceNotFoundException,
    );
  });

  it('T2.17 no technician at the dealership holds the required skill, even if another dealership has one', async () => {
    const world = new World();
    const dealershipA = world.dealership('Dealership A');
    const dealershipB = world.dealership('Dealership B');
    const serviceTypeA = world.serviceType(dealershipA);
    world.bay(dealershipA, 'Bay 01');
    world.technician(dealershipA, 'Tech 01', ['Electrical']);
    world.technician(dealershipB, 'Tech 01');

    await expect(world.book(serviceTypeA, SLOT)).rejects.toThrow(SkillMismatchException);
  });

  it('T2.18 a vehicle with an overlapping Confirmed booking at the same or another dealership is unavailable', async () => {
    const sameDealership = new World();
    {
      const dealership = sameDealership.dealership();
      const serviceType = sameDealership.serviceType(dealership);
      const bay = sameDealership.bay(dealership, 'Bay 01');
      sameDealership.bay(dealership, 'Bay 02');
      const technician = sameDealership.technician(dealership, 'Tech 01');
      sameDealership.technician(dealership, 'Tech 02');
      const vehicle = sameDealership.vehicle('51A12345', '0901234567');
      sameDealership.appointment({ serviceType, bay, technician, vehicle, startTime: SLOT, endTime: SLOT_END });

      await expect(
        sameDealership.book(serviceType, SLOT, { phone: '0901234567', licensePlate: '51A12345' }),
      ).rejects.toThrow(VehicleUnavailableException);
    }

    const otherDealership = new World();
    {
      const dealershipA = otherDealership.dealership('Dealership A');
      const dealershipB = otherDealership.dealership('Dealership B');
      const serviceTypeA = otherDealership.serviceType(dealershipA);
      const serviceTypeB = otherDealership.serviceType(dealershipB);
      otherDealership.bay(dealershipA, 'Bay 01');
      otherDealership.technician(dealershipA, 'Tech 01');
      const bayB = otherDealership.bay(dealershipB, 'Bay 01');
      const techB = otherDealership.technician(dealershipB, 'Tech 01');
      const vehicle = otherDealership.vehicle('51A12345', '0901234567');
      otherDealership.appointment({
        serviceType: serviceTypeB,
        bay: bayB,
        technician: techB,
        vehicle,
        startTime: SLOT,
        endTime: SLOT_END,
      });

      await expect(
        otherDealership.book(serviceTypeA, SLOT, { phone: '0901234567', licensePlate: '51A12345' }),
      ).rejects.toThrow(VehicleUnavailableException);
    }
  });

  it('T2.19 all bays overlapping the interval means bay unavailable, even with a free qualified technician', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    const bay = world.bay(dealership, 'Bay 01');
    const busyTech = world.technician(dealership, 'Tech 01');
    world.technician(dealership, 'Tech 02');
    world.appointment({ serviceType, bay, technician: busyTech, startTime: SLOT, endTime: SLOT_END });

    await expect(world.book(serviceType, SLOT)).rejects.toThrow(BayUnavailableException);
  });

  it('T2.20 all qualified technicians busy means technician unavailable, even with a free bay', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    const otherBay = world.bay(dealership, 'Bay 02');
    const technician = world.technician(dealership, 'Tech 01');
    world.appointment({ serviceType, bay: otherBay, technician, startTime: SLOT, endTime: SLOT_END });

    await expect(world.book(serviceType, SLOT)).rejects.toThrow(TechnicianUnavailableException);
  });
});

describe('BookAppointmentUseCase — T2.21 validation order: the earlier step wins', () => {
  // 09:00–10:00 local on 2030-01-15; NOW is 2030-01-01
  const SLOT = '2030-01-15T02:00:00Z';
  const SLOT_END = '2030-01-15T03:00:00Z';
  const PAST = '2029-12-31T02:00:00Z';

  it('T2.21a unknown dealership + past startTime → not found', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);

    await expect(world.book(serviceType, PAST, { dealershipId: 'unknown-dealership' })).rejects.toThrow(
      ResourceNotFoundException,
    );
  });

  it('T2.21b past startTime + plate/phone mismatch → past start', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 01');
    world.vehicle('51A12345', '0901234567');

    await expect(world.book(serviceType, PAST, { phone: '0999999999', licensePlate: '51A12345' })).rejects.toThrow(
      PastStartTimeException,
    );
  });

  it('T2.21c plate/phone mismatch + no skilled technician → plate/phone mismatch', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 01', ['Electrical']);
    world.vehicle('51A12345', '0901234567');

    await expect(world.book(serviceType, SLOT, { phone: '0999999999', licensePlate: '51A12345' })).rejects.toThrow(
      PlatePhoneMismatchException,
    );
  });

  it('T2.21d no skilled technician + vehicle overlap → skill mismatch', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    world.bay(dealership, 'Bay 01');
    const otherBay = world.bay(dealership, 'Bay 02');
    const unqualified = world.technician(dealership, 'Tech 01', ['Electrical']);
    const vehicle = world.vehicle('51A12345', '0901234567');
    world.appointment({ serviceType, bay: otherBay, technician: unqualified, vehicle, startTime: SLOT, endTime: SLOT_END });

    await expect(world.book(serviceType, SLOT, { phone: '0901234567', licensePlate: '51A12345' })).rejects.toThrow(
      SkillMismatchException,
    );
  });

  it('T2.21e vehicle overlap + all bays busy → vehicle unavailable', async () => {
    const world = new World();
    const dealershipA = world.dealership('Dealership A');
    const dealershipB = world.dealership('Dealership B');
    const serviceTypeA = world.serviceType(dealershipA);
    const serviceTypeB = world.serviceType(dealershipB);
    const bayA = world.bay(dealershipA, 'Bay 01');
    const busyTechA = world.technician(dealershipA, 'Tech 01');
    world.technician(dealershipA, 'Tech 02');
    world.appointment({ serviceType: serviceTypeA, bay: bayA, technician: busyTechA, startTime: SLOT, endTime: SLOT_END });
    const bayB = world.bay(dealershipB, 'Bay 01');
    const techB = world.technician(dealershipB, 'Tech 01');
    const vehicle = world.vehicle('51A12345', '0901234567');
    world.appointment({ serviceType: serviceTypeB, bay: bayB, technician: techB, vehicle, startTime: SLOT, endTime: SLOT_END });

    await expect(world.book(serviceTypeA, SLOT, { phone: '0901234567', licensePlate: '51A12345' })).rejects.toThrow(
      VehicleUnavailableException,
    );
  });

  it('T2.21f all bays busy + all technicians busy → bay unavailable', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership);
    const bay = world.bay(dealership, 'Bay 01');
    const technician = world.technician(dealership, 'Tech 01');
    world.appointment({ serviceType, bay, technician, startTime: SLOT, endTime: SLOT_END });

    await expect(world.book(serviceType, SLOT)).rejects.toThrow(BayUnavailableException);
  });
});

describe('BookAppointmentUseCase — time rules', () => {
  it('T2.22 the use case enforces past-start, working-hours and overnight-consent rules', async () => {
    const world = new World();
    const dealership = world.dealership();
    const serviceType = world.serviceType(dealership, 120);
    world.bay(dealership, 'Bay 01');
    world.technician(dealership, 'Tech 01');

    // NOW is 2030-01-01
    await expect(world.book(serviceType, '2029-12-31T02:00:00Z')).rejects.toThrow(PastStartTimeException);
    // 17:00 local
    await expect(world.book(serviceType, '2030-01-15T10:00:00Z')).rejects.toThrow(OutsideWorkingHoursException);
    // 16:00 local + 120 min → 09:00 local next day
    await expect(world.book(serviceType, '2030-01-15T09:00:00Z')).rejects.toThrow(
      OvernightConsentRequiredException,
    );
    await expect(world.book(serviceType, '2030-01-15T09:00:00Z', { overnightConsent: true })).resolves.toMatchObject({
      status: 'Confirmed',
      endTime: new Date('2030-01-16T02:00:00Z'),
    });
  });
});
