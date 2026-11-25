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
echo "vercel-migrate: applying migrations (production)"
DATABASE_URL="$DIRECT_URL" pnpm exec prisma migrate deploy
