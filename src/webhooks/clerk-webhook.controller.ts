import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { Public } from '../common/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import type { Request } from 'express';

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserData {
  id: string;
  primary_email_address_id?: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | string;
  data: ClerkUserData;
}

// Webhook lives at /webhooks/clerk (version-neutral: Clerk dashboard URL shouldn't carry /v1).
@Controller({ path: 'webhooks/clerk', version: VERSION_NEUTRAL })
export class ClerkWebhookController {
  private readonly log = new Logger(ClerkWebhookController.name);
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    this.secret = this.config.getOrThrow<string>('clerk.webhookSecret');
  }

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTs: string | undefined,
    @Headers('svix-signature') svixSig: string | undefined,
    @Body() _ignored: unknown,
  ) {
    if (!svixId || !svixTs || !svixSig) {
      throw new BadRequestException('Missing svix headers');
    }
    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Raw body required for webhook verification');
    }

    let event: ClerkWebhookEvent;
    try {
      const wh = new Webhook(this.secret);
      event = wh.verify(req.body.toString('utf8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTs,
        'svix-signature': svixSig,
      }) as ClerkWebhookEvent;
    } catch (err) {
      this.log.warn(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.log.log(`Clerk webhook received: ${event.type}`);

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await this.users.upsertFromClerk(this.mapPayload(event.data));
        break;
      case 'user.deleted':
        await this.users.deleteByClerkId(event.data.id);
        break;
      default:
        this.log.debug(`Ignoring unhandled event type: ${event.type}`);
    }

    await this.users.recordAuthEvent({
      clerkUserId: event.data.id,
      type: event.type,
      source: 'clerk_webhook',
      payload: event.data as unknown,
    });

    return { ok: true };
  }

  private mapPayload(data: ClerkUserData) {
    const primary =
      data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
      data.email_addresses?.[0];
    if (!primary) {
      throw new BadRequestException('User payload missing email');
    }
    return {
      clerkUserId: data.id,
      email: primary.email_address,
      firstName: data.first_name ?? null,
      lastName: data.last_name ?? null,
      imageUrl: data.image_url ?? null,
    };
  }
}
