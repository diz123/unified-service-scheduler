import { ArgumentsHost } from '@nestjs/common';
import {
  BayUnavailableException,
  OutsideWorkingHoursException,
  OvernightConsentRequiredException,
  PastStartTimeException,
  PlatePhoneMismatchException,
  ResourceNotFoundException,
  SkillMismatchException,
  TechnicianUnavailableException,
  TransactionTimeoutException,
  VehicleUnavailableException,
} from '../../../src/modules/scheduling/domain/scheduling.exceptions';
import { SchedulingExceptionFilter } from '../../../src/modules/scheduling/presentation/scheduling-exception.filter';

interface Captured {
  status?: number;
  body?: unknown;
}

/** A minimal HTTP ArgumentsHost that records the status and JSON body the filter writes. */
function hostCapturing(captured: Captured): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return {
        json(body: unknown) {
          captured.body = body;
        },
      };
    },
  };
  return { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
}

function statusFor(exception: Error): Captured {
  const captured: Captured = {};
  new SchedulingExceptionFilter().catch(exception, hostCapturing(captured));
  return captured;
}

// CLAUDE.md §7, one entry per exception class. The "Input validation errors → 400" row is produced by
// Nest's ValidationPipe (BadRequestException), not by this filter; T4.5f covers it over HTTP.
const TABLE: ReadonlyArray<[string, number, new () => Error]> = [
  ['BayUnavailableException', 409, BayUnavailableException],
  ['TechnicianUnavailableException', 409, TechnicianUnavailableException],
  ['VehicleUnavailableException', 409, VehicleUnavailableException],
  ['PlatePhoneMismatchException', 409, PlatePhoneMismatchException],
  ['SkillMismatchException', 422, SkillMismatchException],
  ['PastStartTimeException', 400, PastStartTimeException],
  ['OutsideWorkingHoursException', 400, OutsideWorkingHoursException],
  ['OvernightConsentRequiredException', 400, OvernightConsentRequiredException],
  ['ResourceNotFoundException', 404, ResourceNotFoundException],
  ['TransactionTimeoutException', 503, TransactionTimeoutException],
];

describe('SchedulingExceptionFilter — CLAUDE.md §7 exception → HTTP status (T4.8)', () => {
  it.each(TABLE)('T4.8 %s → %i', (_name, expected, Exception) => {
    const exception = new Exception();

    expect(statusFor(exception)).toStrictEqual({
      status: expected,
      body: { statusCode: expected, error: exception.name, message: exception.message },
    });
  });

  it('T4.8 an unlisted error → 500', () => {
    expect(statusFor(new Error('unexpected')).status).toBe(500);
  });
});
