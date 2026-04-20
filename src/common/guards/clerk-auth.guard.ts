import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly log = new Logger(ClerkAuthGuard.name);
  private readonly secretKey: string;
  private readonly issuer?: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    this.secretKey = this.config.getOrThrow<string>('clerk.secretKey');
    this.issuer = this.config.get<string>('clerk.jwtIssuer');
    // Surface misconfig immediately — createClerkClient is cheap and validates shape.
    createClerkClient({ secretKey: this.secretKey });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: this.secretKey,
        ...(this.issuer ? { issuer: this.issuer } : {}),
      });
      req.auth = {
        userId: payload.sub,
        sessionId: (payload.sid as string) ?? null,
        orgId: (payload.org_id as string) ?? null,
        claims: payload as Record<string, unknown>,
      };
      return true;
    } catch (err) {
      this.log.warn(
        { err: err instanceof Error ? err.message : String(err), requestId: req.id },
        'Clerk token verification failed',
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
