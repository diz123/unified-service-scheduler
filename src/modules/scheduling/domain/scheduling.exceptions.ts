export class PastStartTimeException extends Error {
  constructor(message = 'startTime must be in the future') {
    super(message);
    this.name = 'PastStartTimeException';
  }
}

export class OutsideWorkingHoursException extends Error {
  constructor(message = "startTime is outside the dealership's working hours") {
    super(message);
    this.name = 'OutsideWorkingHoursException';
  }
}

export class OvernightConsentRequiredException extends Error {
  constructor(message = 'Overnight consent is required when the service ends on a later local date') {
    super(message);
    this.name = 'OvernightConsentRequiredException';
  }
}

export class BayUnavailableException extends Error {
  constructor(message = 'No service bay is available for the requested time') {
    super(message);
    this.name = 'BayUnavailableException';
  }
}

export class TechnicianUnavailableException extends Error {
  constructor(message = 'No qualified technician is available for the requested time') {
    super(message);
    this.name = 'TechnicianUnavailableException';
  }
}

export class PlatePhoneMismatchException extends Error {
  constructor(message = 'This license plate is registered with a different phone number') {
    super(message);
    this.name = 'PlatePhoneMismatchException';
  }
}

export type NotFoundResource = 'dealership' | 'serviceType';

export class ResourceNotFoundException extends Error {
  constructor(
    readonly resource: NotFoundResource,
    message = resource === 'dealership' ? 'Dealership not found' : 'Service type not found',
  ) {
    super(message);
    this.name = 'ResourceNotFoundException';
  }
}

export class SkillMismatchException extends Error {
  constructor(message = 'No technician at this dealership has the skill this service requires') {
    super(message);
    this.name = 'SkillMismatchException';
  }
}

export class VehicleUnavailableException extends Error {
  constructor(message = 'This vehicle already has a booking that overlaps the requested time') {
    super(message);
    this.name = 'VehicleUnavailableException';
  }
}

export class TransactionTimeoutException extends Error {
  constructor(message = 'The booking could not be completed in time; please retry') {
    super(message);
    this.name = 'TransactionTimeoutException';
  }
}

/** Look Up Appointments found no match; an unknown plate and a phone mismatch are indistinguishable. */
export class AppointmentsNotFoundException extends Error {
  constructor(message = 'No appointments found for this license plate and phone') {
    super(message);
    this.name = 'AppointmentsNotFoundException';
  }
}
