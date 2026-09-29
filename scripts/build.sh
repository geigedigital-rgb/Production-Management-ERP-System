#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$(pwd)/node_modules/.bin:$PATH"
# Drop cached generated client so Railpack / npm cache cannot keep a schema
# without newer Material fields (tagColor, unitsPerKg, …).
rm -rf node_modules/.prisma
prisma generate
# Fail the build if generate silently reused a stale client.
node -e "
  const { Prisma } = require('@prisma/client');
  const fields = Prisma.MaterialScalarFieldEnum || {};
  const need = ['tagColor', 'unitsPerKg', 'packDeliveryCostUah'];
  const missing = need.filter((k) => !(k in fields));
  if (missing.length) {
    console.error('Prisma client missing Material fields:', missing.join(', '));
    process.exit(1);
  }
  console.log('Prisma Material fields OK:', need.join(', '));
"
exec next build --webpack "$@"
