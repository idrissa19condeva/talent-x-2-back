import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            {
              requestId: req.id,
              method: req.method,
              url: req.url,
              userId: req.auth?.userId,
              durationMs: Date.now() - start,
            },
            'request.handled',
          );
        },
      }),
    );
  }
}
