import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createAppLogger } from './shared/infrastructure/logging/app-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: createAppLogger() });
  configureApp(app);
  // Runs onModuleDestroy (Prisma $disconnect) on SIGTERM/SIGINT.
  app.enableShutdownHooks();
  await app.listen(3000);
}

void bootstrap();
