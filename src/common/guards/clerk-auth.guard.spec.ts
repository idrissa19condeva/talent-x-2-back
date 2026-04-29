import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ClerkAuthGuard } from './clerk-auth.guard';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({})),
  verifyToken: jest.fn(),
}));

import { verifyToken } from '@clerk/backend';

const mockCtx = (headers: Record<string, string> = {}): ExecutionContext => {
  const req: { headers: Record<string, string>; auth?: unknown } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
};

describe('ClerkAuthGuard', () => {
  const config = {
    getOrThrow: jest.fn((k: string) => (k === 'clerk.secretKey' ? 'sk_test' : '')),
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  let guard: ClerkAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ClerkAuthGuard(reflector, config);
    (verifyToken as jest.Mock).mockReset();
  });

  it('allows @Public() handlers without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    await expect(guard.canActivate(mockCtx())).resolves.toBe(true);
  });

  it('rejects requests with no bearer token', async () => {
    await expect(guard.canActivate(mockCtx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid tokens', async () => {
    (verifyToken as jest.Mock).mockRejectedValue(new Error('bad token'));
    await expect(
      guard.canActivate(mockCtx({ authorization: 'Bearer abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches auth context when token is valid', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({
      sub: 'user_1',
      sid: 'sess_1',
      org_id: null,
    });
    const ctx = mockCtx({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = (ctx.switchToHttp().getRequest() as unknown) as {
      auth: { userId: string; sessionId: string | null };
    };
    expect(req.auth.userId).toBe('user_1');
    expect(req.auth.sessionId).toBe('sess_1');
  });
});
