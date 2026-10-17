import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
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
} from '../domain/scheduling.exceptions';

/** CLAUDE.md §7 exception → HTTP status table. Errors not listed fall through to Nest's default handling. */
const STATUS_BY_EXCEPTION: ReadonlyArray<[new () => Error, HttpStatus]> = [
  [PastStartTimeException, HttpStatus.BAD_REQUEST],
  [OutsideWorkingHoursException, HttpStatus.BAD_REQUEST],
  [OvernightConsentRequiredException, HttpStatus.BAD_REQUEST],
  [ResourceNotFoundException, HttpStatus.NOT_FOUND],
  [PlatePhoneMismatchException, HttpStatus.CONFLICT],
  [SkillMismatchException, HttpStatus.UNPROCESSABLE_ENTITY],
  [VehicleUnavailableException, HttpStatus.CONFLICT],
  [BayUnavailableException, HttpStatus.CONFLICT],
  [TechnicianUnavailableException, HttpStatus.CONFLICT],
  [TransactionTimeoutException, HttpStatus.SERVICE_UNAVAILABLE],
];

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

@Catch(...STATUS_BY_EXCEPTION.map(([exception]) => exception))
export class SchedulingExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const status =
      STATUS_BY_EXCEPTION.find(([type]) => exception instanceof type)?.[1] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    host
      .switchToHttp()
      .getResponse<JsonResponse>()
      .status(status)
      .json({ statusCode: status, error: exception.name, message: exception.message });
  }
}
