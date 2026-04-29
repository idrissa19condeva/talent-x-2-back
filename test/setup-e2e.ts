// Minimum env so ConfigModule validation passes in e2e tests.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://talentx:talentx@localhost:5432/talentx_test?schema=public';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? 'sk_test_fake';
process.env.CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? 'pk_test_fake';
process.env.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? 'whsec_test_fake';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

jest.setTimeout(30_000);
