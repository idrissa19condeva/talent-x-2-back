import { Controller, Get, Logger, Patch, Body } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UsersService } from './users.service';
import { CurrentAuth } from '../common/decorators/current-user.decorator';
import type { ClerkAuthContext } from '../common/types/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}

@Controller({ path: 'users', version: '1' })
export class UsersController {
  private readonly log = new Logger(UsersController.name);

  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async me(@CurrentAuth() auth: ClerkAuthContext) {
    const user = await this.users.getByClerkIdOrThrow(auth.userId);
    await this.users.touchLastSeen(auth.userId);
    const profile = await this.prisma.profile.findUnique({ where: { userId: user.id } });
    return { user, profile };
  }

  @Patch('me/profile')
  async updateProfile(
    @CurrentAuth() auth: ClerkAuthContext,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.users.getByClerkIdOrThrow(auth.userId);
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, headline: dto.headline, bio: dto.bio },
      update: { headline: dto.headline, bio: dto.bio },
    });
    return { profile };
  }
}
