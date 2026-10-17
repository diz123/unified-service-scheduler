import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
}

/** A body already in the DESIGN.md error format, e.g. the ValidationPipe's VALIDATION_FAILED. */
const isErrorBody = (body: unknown): boolean => typeof body === 'object' && body !== null && 'code' in body;

/**
 * Status of an HTTP exception, or undefined for anything else. Body-parser rejects with `http-errors` objects
 * (`status`, `expose: true`, e.g. 413 for an oversized body), which Nest does not convert to HttpException.
 */
const httpStatusOf = (exception: unknown): number | undefined => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  const candidate = exception as { status?: unknown; expose?: unknown } | null | undefined;
  const isClientError = typeof candidate?.status === 'number' && candidate.status < 500 && candidate.expose === true;
  return isClientError ? (candidate.status as number) : undefined;
};

/**
 * DESIGN.md "Error response format": errors raised outside the scheduling exception filter use the same body.
 * Errors that are not HTTP exceptions are logged server-side and never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();

    if (exception instanceof HttpException && isErrorBody(exception.getResponse())) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const body = this.bodyFor(exception);
    response.status(body.statusCode).json(body);
  }

  private bodyFor(exception: unknown): ErrorBody {
    const status = httpStatusOf(exception);
    if (status === HttpStatus.BAD_REQUEST) {
      // Body-parser rejections such as malformed JSON (DESIGN.md Assumption 14: no `details`).
      return { statusCode: status, code: 'VALIDATION_FAILED', message: 'Request body is malformed' };
    }
    if (status === HttpStatus.NOT_FOUND) {
      return { statusCode: status, code: 'ROUTE_NOT_FOUND', message: 'Route not found' };
    }
    if (status !== undefined) {
      // Framework HTTP errors keep their status (DESIGN.md "Other framework errors"); their messages are generic.
      const message = (exception as { message?: unknown }).message;
      return { statusCode: status, code: 'REQUEST_REJECTED', message: typeof message === 'string' ? message : 'Request rejected' };
    }
    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
