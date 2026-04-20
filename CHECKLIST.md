# TalentX — delivery checklist (backend)

## ✅ Fully implemented
- NestJS 10 skeleton with strict TS, versioned URIs (`/v1/...`)
- Global `ClerkAuthGuard` using `@clerk/backend` `verifyToken`
- `@Public()` decorator for opt-out (health + webhook)
- Prisma schema (`User`, `Profile`, `AuthEvent`) with cascade + indices
- `UsersService` (upsert/delete/touch/authEvent)
- `/v1/users/me` GET + PATCH profile
- `/webhooks/clerk` with `svix` signature verification and raw body middleware
- pino structured logs with request IDs (`x-request-id`) and PII redaction
- `AllExceptionsFilter` → Sentry on 5xx, safe error shape on 4xx
- `LoggingInterceptor` — one line per handled request with `userId`
- `/v1/health` via `@nestjs/terminus` (DB ping)
- `nestjs-i18n` scaffolding with `en` + `fr` errors bundle
- Helmet + CORS allowlist + class-validator strict DTOs
- `.env` validation via `class-validator` on boot
- Docker Compose for Postgres 16
- Unit tests (`users.service.spec`, `clerk-auth.guard.spec`)
- E2E tests (`health.e2e-spec`, `users.e2e-spec`, `clerk-webhook.e2e-spec`)
- GitHub Actions workflow

## ⚠️ Needs external credentials to run end-to-end
- Clerk secret key + webhook signing secret → `.env`
- A reachable HTTPS tunnel for Clerk webhooks in local dev (ngrok)
- Sentry DSN (optional until you want error capture)

## 🧪 Mocked vs real in tests
- **Mocked in unit + e2e:** Prisma, `@clerk/backend.verifyToken`
- **Real in e2e:** `svix` signature verification, NestJS HTTP pipeline,
  validation, guards, filter, i18n loader
- **Not run in CI:** real Postgres connection (CI uses a service container);
  real Clerk/Webhook endpoints — switch `DATABASE_URL` and run `prisma migrate deploy`
  to exercise real DB

## 🔐 Production hardening TODO
- Add `@nestjs/throttler` rate limiting on `/v1/*` and a stricter limit for auth-heavy paths
- Tighten `CORS_ORIGIN` to your actual domains
- Put the API behind TLS + a WAF (e.g. Cloudflare)
- Add a dead-letter/retry path for failed Clerk webhooks (re-drive via a queue)
- Run Prisma migrations via `prisma:deploy` during release, never `migrate dev`
- Enable Sentry performance (`tracesSampleRate`) + release health
- Add log shipping to your observability backend (Loki, Datadog, etc.)
- Harden secrets: use your cloud's secrets manager, not plain `.env`
