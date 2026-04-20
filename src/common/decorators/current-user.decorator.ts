import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, ClerkAuthContext } from '../types/authenticated-request';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClerkAuthContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.auth) {
      throw new UnauthorizedException('No authentication context');
    }
    return req.auth;
  },
);
