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

export class BayUnavailableException extends Error {}

export class TechnicianUnavailableException extends Error {}
