import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { raw } from 'express';
import * as request from 'supertest';
import { Webhook } from 'svix';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Clerk webhook (e2e)', () => {
  let app: INestApplication;
  const webhookSecret = 'whsec_aGVsbG8td29ybGQtdGVzdC1zZWNyZXQtcGFk'; // dummy base64-ish
  const upsertSpy = jest.fn();
  const authEventSpy = jest.fn();

  beforeAll(async () => {
    process.env.CLERK_WEBHOOK_SECRET = webhookSecret;

    const prismaMock = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: upsertSpy.mockResolvedValue({ id: 'u1', clerkUserId: 'clerk_1' }),
        delete: jest.fn(),
      },
      authEvent: { create: authEventSpy.mockResolvedValue({}) },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.use('/webhooks/clerk', raw({ type: 'application/json' }));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid svix signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_1')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,not-a-real-signature')
      .send({ type: 'user.created', data: { id: 'clerk_1' } });
    expect(res.status).toBe(401);
  });

  it('accepts a correctly svix-signed event and syncs the user', async () => {
    const body = JSON.stringify({
      type: 'user.created',
      data: {
        id: 'clerk_1',
        email_addresses: [{ id: 'e1', email_address: 'a@b.com' }],
        primary_email_address_id: 'e1',
        first_name: 'Ada',
        last_name: 'L',
      },
    });
    const msgId = 'msg_test_1';
    const timestamp = new Date();

    // svix v1: sign(id, timestamp, payload) returns a single v1,<sig> string.
    const signature = new Webhook(webhookSecret).sign(msgId, timestamp, body);

    const res = await request(app.getHttpServer())
      .post('/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', msgId)
      .set('svix-timestamp', String(Math.floor(timestamp.getTime() / 1000)))
      .set('svix-signature', signature)
      .send(body);

    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalled();
    expect(authEventSpy).toHaveBeenCalled();
  });
});
