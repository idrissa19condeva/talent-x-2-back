import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma, User } from '@prisma/client';

export interface ClerkUserPayload {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  emailVerifiedAt?: Date | null;
}

@Injectable()
export class UsersService {
  private readonly log = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { clerkUserId } });
  }

  async getByClerkIdOrThrow(clerkUserId: string): Promise<User> {
    const user = await this.findByClerkId(clerkUserId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async upsertFromClerk(payload: ClerkUserPayload): Promise<User> {
    const data: Prisma.UserCreateInput = {
      clerkUserId: payload.clerkUserId,
      email: payload.email,
      firstName: payload.firstName ?? null,
      lastName: payload.lastName ?? null,
      imageUrl: payload.imageUrl ?? null,
      emailVerifiedAt: payload.emailVerifiedAt ?? null,
      profile: { create: {} },
    };
    const user = await this.prisma.user.upsert({
      where: { clerkUserId: payload.clerkUserId },
      create: data,
      update: {
        email: payload.email,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        imageUrl: payload.imageUrl ?? null,
        emailVerifiedAt: payload.emailVerifiedAt ?? null,
      },
    });
    this.log.log(
      `upsert user clerkUserId=${payload.clerkUserId} verified=${payload.emailVerifiedAt ? 'yes' : 'no'}`,
    );
    return user;
  }

  async deleteByClerkId(clerkUserId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkUserId } });
    if (!existing) return;
    await this.prisma.user.delete({ where: { id: existing.id } });
    this.log.log(`deleted user clerkUserId=${clerkUserId}`);
  }

  async touchLastSeen(clerkUserId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { clerkUserId },
      data: { lastSeenAt: new Date() },
    });
  }

  async recordAuthEvent(params: {
    clerkUserId?: string;
    type: string;
    source: 'clerk_webhook' | 'api';
    payload?: unknown;
  }): Promise<void> {
    let userId: string | null = null;
    if (params.clerkUserId) {
      const user = await this.findByClerkId(params.clerkUserId);
      userId = user?.id ?? null;
    }
    await this.prisma.authEvent.create({
      data: {
        userId,
        type: params.type,
        source: params.source,
        payload: (params.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
