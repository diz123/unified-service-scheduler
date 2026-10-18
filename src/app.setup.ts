import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { SchedulingExceptionFilter } from './modules/scheduling/presentation/scheduling-exception.filter';
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter';
import { requestObservability } from './shared/presentation/request-observability.middleware';

/** DESIGN.md "Error response format": validation errors add `details`, one entry per invalid field. */
const validationFailed = (errors: ValidationError[]): BadRequestException =>
  new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: errors.map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join('; ')}`),
  });

/** Global HTTP setup shared by main.ts and the tests: request ID and access log, validation pipe, exception filters. */
export function configureApp(app: INestApplication): void {
  // T8.19: no X-Powered-By header on any response (the Express instance behind the Nest adapter).
  const express: { disable(setting: string): unknown } = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  // Registered before init, so it runs ahead of the body parser and every route (DESIGN.md O-2, O-3).
  app.use(requestObservability);
  // No transform or implicit conversion: a string "false" must fail @IsBoolean (DESIGN.md, T4.7).
  // whitelist strips properties the DTO does not declare.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, exceptionFactory: validationFailed }));
  // The catch-all goes first so the type-specific scheduling filter takes precedence for domain exceptions.
  app.useGlobalFilters(new AllExceptionsFilter(), new SchedulingExceptionFilter());
}
