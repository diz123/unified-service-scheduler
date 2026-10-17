import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulingExceptionFilter } from './modules/scheduling/presentation/scheduling-exception.filter';

/** Global HTTP setup shared by main.ts and the E2E tests: validation pipe and exception filter. */
export function configureApp(app: INestApplication): void {
  // No transform or implicit conversion: a string "false" must fail @IsBoolean (DESIGN.md, T4.7).
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new SchedulingExceptionFilter());
}
