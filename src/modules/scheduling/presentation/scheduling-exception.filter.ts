import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import {
  AppointmentsNotFoundException,
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
} from '../domain/scheduling.exceptions';

interface ErrorMapping {
  type: abstract new (...args: never[]) => Error;
  status: HttpStatus;
  code: (exception: Error) => string;
}

const fixed =
  (code: string) =>
  (): string =>
    code;

/** CLAUDE.md §7 statuses and DESIGN.md error codes. Errors not listed are handled by AllExceptionsFilter. */
const MAPPINGS: readonly ErrorMapping[] = [
  { type: PastStartTimeException, status: HttpStatus.BAD_REQUEST, code: fixed('START_TIME_IN_PAST') },
  { type: OutsideWorkingHoursException, status: HttpStatus.BAD_REQUEST, code: fixed('OUTSIDE_WORKING_HOURS') },
  {
    type: OvernightConsentRequiredException,
    status: HttpStatus.BAD_REQUEST,
    code: fixed('OVERNIGHT_CONSENT_REQUIRED'),
  },
  {
    type: ResourceNotFoundException,
    status: HttpStatus.NOT_FOUND,
    code: (exception) =>
      exception instanceof ResourceNotFoundException && exception.resource === 'serviceType'
        ? 'SERVICE_TYPE_NOT_FOUND'
        : 'DEALERSHIP_NOT_FOUND',
  },
  { type: PlatePhoneMismatchException, status: HttpStatus.CONFLICT, code: fixed('PLATE_PHONE_MISMATCH') },
  { type: SkillMismatchException, status: HttpStatus.UNPROCESSABLE_ENTITY, code: fixed('NO_QUALIFIED_TECHNICIAN') },
  { type: VehicleUnavailableException, status: HttpStatus.CONFLICT, code: fixed('VEHICLE_UNAVAILABLE') },
  { type: BayUnavailableException, status: HttpStatus.CONFLICT, code: fixed('BAY_UNAVAILABLE') },
  { type: TechnicianUnavailableException, status: HttpStatus.CONFLICT, code: fixed('TECHNICIAN_UNAVAILABLE') },
  { type: TransactionTimeoutException, status: HttpStatus.SERVICE_UNAVAILABLE, code: fixed('SERVICE_BUSY') },
  { type: AppointmentsNotFoundException, status: HttpStatus.NOT_FOUND, code: fixed('APPOINTMENTS_NOT_FOUND') },
];

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

@Catch(...MAPPINGS.map((mapping) => mapping.type))
export class SchedulingExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const mapping = MAPPINGS.find(({ type }) => exception instanceof type);
    if (!mapping) {
      // Unreachable: @Catch lists only mapped types, so Nest never routes an unmapped error here.
      throw exception;
    }
    // DESIGN.md "Error response format": { statusCode, code, message }; never the exception class name.
    host
      .switchToHttp()
      .getResponse<JsonResponse>()
      .status(mapping.status)
      .json({ statusCode: mapping.status, code: mapping.code(exception), message: exception.message });
  }
}
