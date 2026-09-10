#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$(pwd)/node_modules/.bin:$PATH"
prisma migrate deploy
exec next start "$@"
