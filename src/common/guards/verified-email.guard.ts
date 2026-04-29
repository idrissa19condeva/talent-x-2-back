import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_VERIFIED_KEY } from '../decorators/requires-verified.decorator';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Per-handler guard. When a route is annotated with @RequiresVerified(),
 * this guard looks up the synced user (by Clerk userId on req.auth) and
 * rejects the request if emailVerifiedAt is null.
 *
 * The guard does NOT replace ClerkAuthGuard — it runs after it. Endpoints
 * that don't carry the @RequiresVerified() metadata are allowed through.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  private readonly log = new Logger(VerifiedEmailGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_VERIFIED_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      throw new ForbiddenException('Unauthenticated');
    }

    const user = await this.users.findByClerkId(clerkUserId);
    if (!user || !user.emailVerifiedAt) {
      this.log.warn(`verified-email guard rejected clerkUserId=${clerkUserId}`);
      throw new ForbiddenException('email_not_verified');
    }
    return true;
  }
}
