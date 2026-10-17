import { normalizeLicensePlate } from '../domain/license-plate';
import { normalizePhone } from '../domain/phone';
import { AppointmentsNotFoundException, ResourceNotFoundException } from '../domain/scheduling.exceptions';
import { LookUpAppointmentsQuery } from './commands/look-up-appointments.query';
import {
  AppointmentSummary,
  DealershipSummary,
  SchedulingReadModel,
  ServiceTypeSummary,
} from './ports/scheduling-read-model.port';

/** List Dealerships, List Service Types and Look Up Appointments (DESIGN.md, Read-Only Operations). */
export class SchedulingQueries {
  constructor(private readonly readModel: SchedulingReadModel) {}

  listDealerships(): Promise<DealershipSummary[]> {
    return this.readModel.listDealerships();
  }

  async listServiceTypes(dealershipId: string): Promise<ServiceTypeSummary[]> {
    const serviceTypes = await this.readModel.listServiceTypes(dealershipId);
    if (!serviceTypes) {
      throw new ResourceNotFoundException('dealership');
    }
    return serviceTypes;
  }

  async lookUpAppointments(query: LookUpAppointmentsQuery): Promise<AppointmentSummary[]> {
    const vehicle = await this.readModel.findVehicleByPlate(normalizeLicensePlate(query.licensePlate));
    // An unknown plate and a phone mismatch must look the same (no enumeration).
    if (!vehicle || normalizePhone(vehicle.ownerPhone) !== normalizePhone(query.phone)) {
      throw new AppointmentsNotFoundException();
    }
    return this.readModel.listAppointmentsForVehicle(vehicle.vehicleId);
  }
}
