import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { SchedulingExceptionFilter } from './modules/scheduling/presentation/scheduling-exception.filter';
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter';

/** DESIGN.md "Error response format": validation errors add `details`, one entry per invalid field. */
const validationFailed = (errors: ValidationError[]): BadRequestException =>
  new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: errors.map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join('; ')}`),
  });

/** Global HTTP setup shared by main.ts and the E2E tests: validation pipe and exception filter. */
export function configureApp(app: INestApplication): void {
  // No transform or implicit conversion: a string "false" must fail @IsBoolean (DESIGN.md, T4.7).
  // whitelist strips properties the DTO does not declare.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, exceptionFactory: validationFailed }));
  // The catch-all goes first so the type-specific scheduling filter takes precedence for domain exceptions.
  app.useGlobalFilters(new AllExceptionsFilter(), new SchedulingExceptionFilter());
}
