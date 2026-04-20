import 'reflect-metadata';
import { initSentry } from './logger/sentry.init';
initSentry(); // must run before Nest boots so unhandled errors are captured

import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { json, raw } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLogger);
  app.useLogger(logger);

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? '*').split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Webhook route needs the raw body for signature verification — mount before json parser.
  app.use('/webhooks/clerk', raw({ type: 'application/json' }));
  app.use(json({ limit: '1mb' }));

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log(`TalentX API listening on :${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {

  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
