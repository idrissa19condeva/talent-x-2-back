import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';

@Module({
  providers: [UsersService, VerifiedEmailGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
