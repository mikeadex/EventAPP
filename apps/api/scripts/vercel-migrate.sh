#!/bin/sh
# Apply pending Prisma migrations during a Vercel *production* build only.
# Preview builds share the production DATABASE_URL, so they must never migrate.
# Neon migrations fail through the pooler, so use the direct host (same name
# without "-pooler"). Never echo the URL: it carries the password.
set -eu
if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "vercel-migrate: VERCEL_ENV=${VERCEL_ENV:-unset}, skipping migrations"
  exit 0
fi
DIRECT_URL=$(printf '%s' "$DATABASE_URL" | sed 's/-pooler\././')

# Check before deploying, because `migrate deploy` takes an advisory lock
# BEFORE it works out whether there is anything to do — so a deploy with no
# pending migrations, which is nearly all of them, could still fail on a lock
# held by something else. `migrate status` takes no lock and exits non-zero
# when migrations are pending.
#
# This is not hypothetical: a build with all 11 migrations already applied
# died on `Timed out trying to acquire a postgres advisory lock`, having had
# no work to do. A lock can be left behind by a run that went through the
# pooler (PgBouncer can return a session to the pool still holding one) or by
# a second build migrating at the same time.
if DATABASE_URL="$DIRECT_URL" pnpm exec prisma migrate status >/dev/null 2>&1; then
  echo "vercel-migrate: no pending migrations, nothing to apply"
  exit 0
fi

echo "vercel-migrate: applying migrations (production)"
DATABASE_URL="$DIRECT_URL" pnpm exec prisma migrate deploy
