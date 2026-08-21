#!/bin/bash
#
# Install both apps' dependencies when a Claude Code on the web container starts.
#
# The remote container is ephemeral: it is reclaimed after a period of inactivity, and the
# next session gets a brand-new machine with a fresh clone. node_modules is not in git, so
# without this every session's first build/test fails with "nest: not found" until someone
# runs npm install by hand — twice, once per app.
#
# Runs SYNCHRONOUSLY on purpose: the session should not start until the toolchain is real,
# or the agent can reach for `npm test` while the install is still running.
set -euo pipefail

# Local machines already have their own working setup — this exists for the web container.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# `npm install` rather than `npm ci`: the container image is cached after the hook finishes,
# so an unchanged lockfile makes the next start close to a no-op. `ci` deletes node_modules
# first and would throw that cache away every single time.
for app in backend frontend; do
  dir="$ROOT/$app"
  [ -f "$dir/package.json" ] || continue
  echo "[session-start] installing $app dependencies…"
  (cd "$dir" && npm install --no-audit --no-fund --loglevel=error)
done

echo "[session-start] dependencies ready (backend + frontend)"
