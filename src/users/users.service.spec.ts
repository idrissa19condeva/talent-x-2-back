import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock>; authEvent: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        updateMany: jest.fn(),
      },
      authEvent: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('upserts a user from Clerk payload (verified email persists)', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1', clerkUserId: 'clerk_1' });
    const verifiedAt = new Date('2026-04-01T12:00:00Z');

    const result = await service.upsertFromClerk({
      clerkUserId: 'clerk_1',
      email: 'a@b.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      imageUrl: null,
      emailVerifiedAt: verifiedAt,
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: 'clerk_1' },
        create: expect.objectContaining({ emailVerifiedAt: verifiedAt }),
        update: expect.objectContaining({ emailVerifiedAt: verifiedAt }),
      }),
    );
    expect(result).toEqual({ id: 'u1', clerkUserId: 'clerk_1' });
  });

  it('upserts a user with null emailVerifiedAt when unverified', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u2', clerkUserId: 'clerk_2' });
    await service.upsertFromClerk({
      clerkUserId: 'clerk_2',
      email: 'b@c.com',
    });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ emailVerifiedAt: null }),
      }),
    );
  });

  it('deletes a user by clerk id when it exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.delete.mockResolvedValue({});
    await service.deleteByClerkId('clerk_1');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('no-ops delete when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await service.deleteByClerkId('missing');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('records an auth event attached to a user if resolvable', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await service.recordAuthEvent({
      clerkUserId: 'clerk_1',
      type: 'user.created',
      source: 'clerk_webhook',
      payload: { foo: 'bar' },
    });
    expect(prisma.authEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'user.created',
        source: 'clerk_webhook',
      }),
    });
  });

  it('records orphan auth event if user cannot be resolved', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await service.recordAuthEvent({ type: 'user.deleted', source: 'clerk_webhook' });
    expect(prisma.authEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: null, type: 'user.deleted' }),
    });
  });
});
