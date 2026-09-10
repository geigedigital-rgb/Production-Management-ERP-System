#!/usr/bin/env bash
# Prefer a working Node 20/22 over a broken Homebrew default (e.g. Node 25
# linked against a missing libsimdjson.29.dylib).
set -euo pipefail

prefer_bins=()
if [[ -x /opt/homebrew/opt/node@22/bin/node ]]; then
  prefer_bins+=(/opt/homebrew/opt/node@22/bin)
elif [[ -x /usr/local/opt/node@22/bin/node ]]; then
  prefer_bins+=(/usr/local/opt/node@22/bin)
elif [[ -x /opt/homebrew/opt/node@20/bin/node ]]; then
  prefer_bins+=(/opt/homebrew/opt/node@20/bin)
fi

if ((${#prefer_bins[@]})); then
  export PATH="${prefer_bins[0]}:$PATH"
fi

node_bin="$(command -v node || true)"
if [[ -z "$node_bin" ]]; then
  echo "Node.js is not installed." >&2
  exit 1
fi

if ! node -e "process.exit(0)" >/dev/null 2>&1; then
  echo "Default node at $node_bin is broken (dyld/library load failure)." >&2
  echo "Install Node 22: brew install node@22 && brew link --force --overwrite node@22" >&2
  exit 1
fi

major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$major" -ge 25 ]]; then
  echo "Warning: Node $major detected. This project is validated on Node 20–22." >&2
fi

exec "$@"
