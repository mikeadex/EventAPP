# Ekklesia

A church-focused event marketplace — Eventbrite for faith communities.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** NestJS + Prisma + PostgreSQL + Better Auth + Stripe Connect
- **Web:** Next.js 15 (App Router) — public marketplace, organizer console, platform admin
- **Mobile:** Expo (React Native) + expo-router — iOS + Android from one codebase
- **Shared:** `@ekklesia/shared` (DTOs, enums, Zod schemas), `@ekklesia/ui` (design tokens)

## Layout

```
apps/
  api/      NestJS backend
  web/      Next.js web (public + console + admin)
  mobile/   Expo React Native app
packages/
  shared/   Cross-runtime DTOs, enums, validation
  ui/       Design tokens + primitives
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Start Postgres
docker compose up -d

# 3. Copy env
cp .env.example .env

# 4. Migrate + seed DB
pnpm db:migrate
pnpm db:seed

# 5. Run everything
pnpm dev
```

- API: http://localhost:4000
- Web: http://localhost:3000
- Mobile: `pnpm --filter @ekklesia/mobile start`

## Optional services

These are off by default — the app works without them, with graceful fallbacks.

### Image uploads (MinIO, S3-compatible)

```bash
brew install minio/stable/minio
mkdir -p ~/minio-data
minio server ~/minio-data --console-address :9001 &

# In another tab, create the bucket + make it public-read.
brew install minio/stable/mc
mc alias set local http://localhost:9000 minio minio12345
mc mb local/ekklesia-dev
mc anonymous set download local/ekklesia-dev
```

Then in `.env`:

```env
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio12345
```

Restart the API. The "Cover image" / "Church logo" uploaders on the organizer
forms will now work.

### Transactional email (Resend)

Sign up at https://resend.com → create an API key → add to `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM="Ekklesia <onboarding@resend.dev>"   # or your verified domain
```

Without a key, RSVP confirmation emails are logged to the API console instead
of dispatched — useful for development.

## Markets

UK, EU, US. Open marketplace from day one. GDPR baseline.

## Phases

1. **Foundation** — monorepo, schema, auth, roles, feature flags, CI *(current)*
2. **Free marketplace** — discovery, church pages, free RSVP, tickets
3. **Organizer + admin consoles** — onboarding, verification, moderation
4. **Payments** — Stripe Connect, paid tickets, donations, payouts
5. **Scale + compliance** — analytics, GDPR tooling, observability
