#!/bin/sh
# Migrations run before the server accepts traffic. An additive migration left pending is how a
# deploy breaks production the moment it starts serving, so a failure here must stop the boot
# rather than let a half-migrated app come up.
set -e
echo "==> applying migrations"
pnpm exec prisma migrate deploy
echo "==> starting"
exec "$@"
