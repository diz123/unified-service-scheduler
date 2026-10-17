export interface WorkingHours {
  /** Local time `HH:mm`. */
  openTime: string;
  /** Local time `HH:mm`. */
  closeTime: string;
  /** IANA timezone identifier. */
  timezone: string;
}

export interface ServiceWindow {
  endTime: Date;
  /** True when `endTime` falls on a later local date than `startTime`. */
  spansOvernight: boolean;
}

export function computeServiceWindow(
  _startTime: Date,
  _durationMinutes: number,
  _hours: WorkingHours,
): ServiceWindow {
  throw new Error('Not implemented');
}

export function assertStartNotInPast(_startTime: Date, _now: Date): void {
  throw new Error('Not implemented');
}

export function assertStartWithinWorkingHours(_startTime: Date, _hours: WorkingHours): void {
  throw new Error('Not implemented');
}

export function assertOvernightConsent(_window: ServiceWindow, _overnightConsent?: boolean): void {
  throw new Error('Not implemented');
}
