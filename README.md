# TalentX — Backend API

NestJS 10 · TypeScript · PostgreSQL · Prisma · Clerk · Pino · Sentry · nestjs-i18n

The backend trusts **Clerk** as the identity provider. It verifies Clerk-issued
JWTs on every protected route, mirrors user data into PostgreSQL via webhooks,
and exposes a minimal user/profile API.

## Stack highlights

- **Auth:** `@clerk/backend` (`verifyToken`) — no parallel password system
- **Webhooks:** `svix` signature verification at `POST /webhooks/clerk`
- **DB:** PostgreSQL 16 via Docker Compose, Prisma 5
- **Observability:** pino structured logs with request IDs, global exception filter, Sentry
- **i18n:** `nestjs-i18n` scaffolded with `en` + `fr`
- **Safety:** helmet, CORS allowlist, class-validator, env schema validation
- **Tests:** Jest unit + Supertest e2e

## Project structure

```
src/
├── app.module.ts
├── main.ts
├── config/                # env loading + validation
├── common/
│   ├── decorators/        # @Public(), @CurrentAuth()
│   ├── filters/           # AllExceptionsFilter
│   ├── guards/            # ClerkAuthGuard (JWT verify)
│   ├── interceptors/      # LoggingInterceptor
│   └── types/
├── prisma/                # PrismaService + PrismaModule
├── health/                # /v1/health
├── users/                 # /v1/users/me, /v1/users/me/profile
├── webhooks/              # POST /webhooks/clerk (svix)
├── logger/                # Sentry init
└── i18n/
    ├── en/
    └── fr/
prisma/schema.prisma
test/                      # e2e specs
docker-compose.yml
```

## Prerequisites

- Node 20+
- Docker (for local Postgres) — or your own Postgres instance
- A Clerk application (https://dashboard.clerk.com) in **Development** mode

## Setup

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env
# Fill in:
#   CLERK_SECRET_KEY        (Clerk Dashboard > API Keys > Secret)
#   CLERK_PUBLISHABLE_KEY
#   CLERK_WEBHOOK_SECRET    (Clerk Dashboard > Webhooks > your endpoint > Signing Secret)
#   DATABASE_URL            (docker default works out of the box)

# 3. Start Postgres
npm run db:up

# 4. Run migrations  (creates User, Profile, AuthEvent + adds emailVerifiedAt)
npm run prisma:migrate -- --name init

# 5. Dev server
npm run start:dev
```

The API is available at `http://localhost:4000/v1`. Health: `GET /v1/health`.

## Clerk webhook setup (local)

Clerk webhooks must reach your machine. Two good options:

1. **ngrok** — `ngrok http 4000`, then register `https://<id>.ngrok.app/webhooks/clerk`
2. **Clerk CLI tunneling** if available in your environment

In the Clerk Dashboard:

1. Webhooks → **Add Endpoint**
2. URL: `https://<your-tunnel>/webhooks/clerk`
3. Subscribe to: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** into `CLERK_WEBHOOK_SECRET`

## Scripts

| Script                  | What it does                                |
| ----------------------- | ------------------------------------------- |
| `npm run start:dev`     | Watch mode with pretty logs                 |
| `npm run build`         | Compile to `dist/`                          |
| `npm run start:prod`    | Run compiled output                         |
| `npm run lint`          | ESLint + auto-fix                           |
| `npm run format`        | Prettier                                    |
| `npm test`              | Unit tests                                  |
| `npm run test:cov`      | Unit tests + coverage                       |
| `npm run test:e2e`      | Supertest e2e                               |
| `npm run prisma:migrate`| Dev migration                               |
| `npm run prisma:deploy` | Production migration                        |
| `npm run prisma:studio` | Prisma Studio                               |
| `npm run db:up/down`    | Start/stop local Postgres                   |
| `npm run db:reset`      | Drop + rerun migrations (dangerous locally) |

## API surface (v1)

| Method | Path                   | Auth                | Purpose                    |
| ------ | ---------------------- | ------------------- | -------------------------- |
| GET    | `/v1/health`           | public              | Liveness + DB ping         |
| GET    | `/v1/users/me`         | Bearer              | Current user + profile (includes `emailVerified` boolean) |
| PATCH  | `/v1/users/me/profile` | Bearer + verified ✉️ | Update headline/bio        |
| POST   | `/webhooks/clerk`      | svix signature      | Clerk user sync (creates / updates `emailVerifiedAt`) |

Errors follow a shared shape:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "requestId": "2b8f…",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/v1/users/me"
}
```

## Observability

- Every request is tagged with a `requestId` (echoed back as `x-request-id`).
- `LoggingInterceptor` logs one structured line per handled request.
- `AllExceptionsFilter` logs 5xx as `error`, 4xx as `warn`, and forwards 5xx to
  Sentry when `SENTRY_DSN` is set.
- Authorization headers, cookies, and svix signatures are redacted from logs.

## Email verification awareness

- `User.emailVerifiedAt` is a nullable timestamp set whenever the Clerk
  webhook delivers a `user.created` / `user.updated` event whose primary email
  has `verification.status === 'verified'`.
- `GET /v1/users/me` returns `user.emailVerified` (boolean) so the mobile app
  can render the user's verification status without a second round-trip.
- Endpoints that require a verified email apply both guards:
  ```ts
  @UseGuards(VerifiedEmailGuard)
  @RequiresVerified()
  async updateProfile() { ... }
  ```
  `VerifiedEmailGuard` reads the `RequiresVerified` metadata, looks up the
  Clerk-synced row, and rejects with 403 `email_not_verified` if the user has
  no `emailVerifiedAt`. The frontend surfaces this as a translated banner.

## Security notes

- Webhook signatures are verified with the raw request body (`express.raw`
  middleware mounted only on `/webhooks/clerk`).
- `helmet` is enabled with defaults.
- `class-validator` rejects unknown fields.
- Secrets live only in `.env`; `.env` is gitignored.
- The backend never accepts an `emailVerifiedAt` flag from the frontend — the
  field is **only** writable by the Clerk webhook handler, after svix verifies
  the signature. The `RequiresVerified` guard exists so handlers can opt-in to
  enforcing a verified email without trusting any frontend assertion.
- For production add rate limiting (e.g. `@nestjs/throttler`) and a stricter
  `CORS_ORIGIN`.

## Testing

- **Unit tests** (`*.spec.ts`, colocated): services, guards.
- **E2E tests** (`test/*.e2e-spec.ts`): Clerk verifier and Prisma are mocked so
  CI does not need real infrastructure.

Run `npm run test:cov` to collect coverage.
