import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request';

interface ErrorBody {
  statusCode: number;
  message: string;
  error?: string;
  requestId?: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AuthenticatedRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | undefined;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const obj = resp as Record<string, unknown>;
        message = (obj.message as string) ?? exception.message;
        error = obj.error as string | undefined;
        details = obj;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      requestId: req.id,
      timestamp: new Date().toISOString(),
      path: req.url,
      details: process.env.NODE_ENV === 'production' ? undefined : details,
    };

    if (status >= 500) {
      this.logger.error({ err: exception, requestId: req.id, path: req.url }, 'Unhandled error');
      if (process.env.SENTRY_DSN) {
        Sentry.withScope((scope) => {
          scope.setTag('requestId', req.id ?? 'unknown');
          scope.setExtra('path', req.url);
          scope.setExtra('method', req.method);
          Sentry.captureException(exception);
        });
      }
    } else {
      this.logger.warn({ status, requestId: req.id, path: req.url, message }, 'Handled error');
    }

    res.status(status).json(body);
  }
}
