#!/usr/bin/env bash
# check.sh — the gate, runnable independently (locally, pre-push) and by CI (the
# reusable cordon gate runs it). It runs cordon's checks engine over this repo's
# cordon.checks.json — every check is declared as data there, so local and CI
# can't drift. This wrapper is identical in every cordon repo; what differs is
# only cordon.checks.json. Pass engine flags through, e.g. `scripts/check.sh --json`.
#
# Engine resolution, fastest first: a local cordon checkout (dev machines),
# the repo's pinned cordon-spec devDependency, else the published package via
# npx — cordon is on npm now, so a fresh machine needs no download step.
set -e
export CORDON_HOME="${CORDON_HOME:-${ASSETS_HOME:-$HOME/Documents/Code/Assets}/cordon}"
root="$(cd "$(dirname "$0")/.." && pwd)"
# The CI gate passes --ci; the engine detects CI on its own, so drop it.
[ "${1:-}" = "--ci" ] && shift
if [ -f "$CORDON_HOME/checks/run.mjs" ]; then
  exec node "$CORDON_HOME/checks/run.mjs" --root "$root" "$@"
fi
if [ -f "$root/node_modules/cordon-spec/checks/run.mjs" ]; then
  exec node "$root/node_modules/cordon-spec/checks/run.mjs" --root "$root" "$@"
fi
exec npx -y cordon-spec@1 cordon-checks --root "$root" "$@"
