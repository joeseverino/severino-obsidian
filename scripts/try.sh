#!/usr/bin/env bash
# try.sh — kick the tires on this scaffold. An agent (or a human) can call this
# to SEE the emit-once contract work end to end before touching anything. Every
# step is non-destructive: it prints the contract and runs the example tool.
set -euo pipefail
# Resolve our own dir to an absolute path BEFORE the cd, so sourcing works no
# matter where we're invoked from (repo root, scripts/, or an absolute path).
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/_lib.sh
source "$here/_lib.sh"   # in-repo presentation; no external dependency
cd "$here/.."

# Needs $TOOLS_HOME (exported from ~/.zshrc): the example tool sources the
# canonical describe.sh from there, and says so itself if it's unset.

STEPS=5

banner "try" "the emit-once contract, end to end — every step is non-destructive"

step 1 "human help" "rendered from describe_spec — the -h text a person reads"
run ./bin/example-tool -h

step 2 "machine contract" "the same spec as --describe JSON; an agent risk-gates on .effect"
run ./bin/example-tool --describe --pretty

step 3 "dry run" "-n exercises the surface and mutates nothing"
run ./bin/example-tool -n widget

step 4 "real run" "the handler fires; effect=read, so still nothing is persisted"
run ./bin/example-tool widget

step 5 "the gate" "shellcheck + contract drift + schema conformance — exactly what CI runs"
run ./scripts/check.sh

rule
printf '%s%s ✓ walkthrough complete%s\n\n' "$B" "$GR" "$R"
printf '%snext — make it yours:%s\n' "$B" "$R"
printf '   %s1%s  edit %sbin/example-tool%s ➜ rewrite describe_spec\n' "$CY" "$R" "$B" "$R"
printf '   %s2%s  regenerate the golden contract\n' "$CY" "$R"
printf '       %s./bin/example-tool --describe > contract/example-tool.json%s\n' "$D" "$R"
