import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({})),
  verifyToken: jest.fn(async (token: string) => {
    if (token === 'valid') return { sub: 'clerk_user_1', sid: 'sess_1' };
    throw new Error('invalid token');
  }),
}));

describe('Users (e2e) — protected routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn(),
      user: {
        findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) => {
          if (where.clerkUserId === 'clerk_user_1') {
            return { id: 'u1', clerkUserId: 'clerk_user_1', email: 'a@b.com' };
          }
          return null;
        }),
        updateMany: jest.fn(),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1', headline: 'hi' }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects /v1/users/me without token', async () => {
    const res = await request(app.getHttpServer()).get('/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects /v1/users/me with invalid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', 'Bearer bad');
    expect(res.status).toBe(401);
  });

  it('returns current user when token is valid', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', 'Bearer valid');
    expect(res.status).toBe(200);
    expect(res.body.user.clerkUserId).toBe('clerk_user_1');
  });
});
