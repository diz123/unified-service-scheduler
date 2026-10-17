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

function responseFor(exception: Error): Captured {
  const captured: Captured = {};
  new SchedulingExceptionFilter().catch(exception, hostCapturing(captured));
  return captured;
}

// CLAUDE.md §7 statuses and DESIGN.md error codes, one entry per exception (ResourceNotFound once per resource).
// The "Input validation errors → 400 VALIDATION_FAILED" row comes from the ValidationPipe; T4.11 covers it.
const TABLE: ReadonlyArray<[string, number, string, () => Error]> = [
  ['BayUnavailableException', 409, 'BAY_UNAVAILABLE', () => new BayUnavailableException()],
  ['TechnicianUnavailableException', 409, 'TECHNICIAN_UNAVAILABLE', () => new TechnicianUnavailableException()],
  ['VehicleUnavailableException', 409, 'VEHICLE_UNAVAILABLE', () => new VehicleUnavailableException()],
  ['PlatePhoneMismatchException', 409, 'PLATE_PHONE_MISMATCH', () => new PlatePhoneMismatchException()],
  ['SkillMismatchException', 422, 'NO_QUALIFIED_TECHNICIAN', () => new SkillMismatchException()],
  ['PastStartTimeException', 400, 'START_TIME_IN_PAST', () => new PastStartTimeException()],
  ['OutsideWorkingHoursException', 400, 'OUTSIDE_WORKING_HOURS', () => new OutsideWorkingHoursException()],
  [
    'OvernightConsentRequiredException',
    400,
    'OVERNIGHT_CONSENT_REQUIRED',
    () => new OvernightConsentRequiredException(),
  ],
  [
    'ResourceNotFoundException (dealership)',
    404,
    'DEALERSHIP_NOT_FOUND',
    () => new ResourceNotFoundException('dealership'),
  ],
  [
    'ResourceNotFoundException (serviceType)',
    404,
    'SERVICE_TYPE_NOT_FOUND',
    () => new ResourceNotFoundException('serviceType'),
  ],
  ['TransactionTimeoutException', 503, 'SERVICE_BUSY', () => new TransactionTimeoutException()],
];

describe('SchedulingExceptionFilter — status and error code per exception (T4.8)', () => {
  it.each(TABLE)('T4.8 %s → %i %s', (_name, status, code, create) => {
    const exception = create();

    expect(responseFor(exception)).toStrictEqual({
      status,
      body: { statusCode: status, code, message: exception.message },
    });
  });
});
