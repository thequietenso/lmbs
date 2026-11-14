import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiExceptionFilter } from './exception.filter';
import { validateEnvironment } from '../config/environment';
export function configureApp(app: INestApplication) {
  const config = validateEnvironment();
  // One-hop trust is opt-in and only safe behind the non-exposed Compose API.
  // Native/direct access defaults to false, ignoring forged forwarding headers.
  app.getHttpAdapter().getInstance().set('trust proxy', config.trustProxyHops === 1 ? 1 : false);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Idempotency-Key',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test')
        console.log(
          JSON.stringify({
            level: 'info',
            event: 'request_complete',
            requestId,
            method: req.method,
            status: res.statusCode,
            elapsedMs: Date.now() - started,
          }),
        );
    });
    next();
  });
  app.enableShutdownHooks();
  return config;
}
