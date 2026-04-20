export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? '',
    secretKey: process.env.CLERK_SECRET_KEY ?? '',
    jwtIssuer: process.env.CLERK_JWT_ISSUER,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET ?? '',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  },
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
});
