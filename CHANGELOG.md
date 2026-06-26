# Changelog

Two axes, kept distinct:

- **Starter release** — this repo, on [SemVer](https://semver.org). Bump when the
  scaffold's own shape changes.
- **Cordon `schema_version`** — the contract revision the emitted JSON targets
  (currently `4`, schema `cordon-v4.json`). Tracked separately because a project
  can stay on the starter while the contract revs.

## [1.1.0](https://github.com/joeseverino/severino-obsidian/compare/v1.0.0...v1.1.0) (2026-06-26)


### Features

* self-filling daily note — populate brief region on open ([#8](https://github.com/joeseverino/severino-obsidian/issues/8)) ([e0812b4](https://github.com/joeseverino/severino-obsidian/commit/e0812b4563ca01bbc4df95e8591180bf34511332))

## 1.0.0 (2026-06-24)


### Features

* ask-the-vault — MCP find ranking through Obsidian's quick-switcher ([3103754](https://github.com/joeseverino/severino-obsidian/commit/31037545979cf9597f7f2373ac6c106598b0e3ca))
* Backlog tab is context-scoped with a Project/All toggle ([8eeef83](https://github.com/joeseverino/severino-obsidian/commit/8eeef833945f7bbf6c0f49a7d2ce07f99165cb32))
* cockpit auto-tidy — reconcile hand-edited task statuses on open/refresh ([52c85e3](https://github.com/joeseverino/severino-obsidian/commit/52c85e3c31c7d5f3d3db8affb7394b9a165cee2c))
* cockpit panels (projects + launcher, vault doctor), brand mark, badge ([7d0f1df](https://github.com/joeseverino/severino-obsidian/commit/7d0f1df6e1b08bdae5caf03a4a638989b7406cdf))
* cockpit polish — header actions, inbox triage, shipped feed, single tooltips ([d82eb87](https://github.com/joeseverino/severino-obsidian/commit/d82eb87427f52f152d8092f6fc77c3090f21899b))
* cockpit shell — extensible panel host + backlog panel ([1620d01](https://github.com/joeseverino/severino-obsidian/commit/1620d012d4f7fa4a6da4eccce98f3d8e020f62f5))
* cockpit v2 — tabbed, context-aware, auto-refreshing, polished ([940de60](https://github.com/joeseverino/severino-obsidian/commit/940de60d6a2bbdcde0109834abe5d01f35a376a9))
* cohesion pass — version SSOT, preview harness, shared previewStyles ([e241491](https://github.com/joeseverino/severino-obsidian/commit/e241491ddb597eddbee2103440e658ac9d50c471))
* New task — native modal, thin over the MCP ([a6ac24e](https://github.com/joeseverino/severino-obsidian/commit/a6ac24e1f10e9250f6b1e8f0ebe25e90f9127b9f))
* promote inbox note to a task (body preserved), reusing the task modal ([3023641](https://github.com/joeseverino/severino-obsidian/commit/3023641ea797856fbc5bf18b7a2980d72da4a3de))
* relation editor — registry/schema-backed frontmatter edits ([c2fb4c7](https://github.com/joeseverino/severino-obsidian/commit/c2fb4c794776c19efbaaebfa9d0a099cb17819b4))
* severino-obsidian — site-accurate writeup preview + cohesion power-ups ([15d1d69](https://github.com/joeseverino/severino-obsidian/commit/15d1d69cb5ce222f00039c95ab9bfd6673f1f16b))


### Bug Fixes

* no-flash cockpit + section counts + Shipped collapsed by default ([d20ac62](https://github.com/joeseverino/severino-obsidian/commit/d20ac62f0dbe1f9d988e084d3657a80e9d4eda96))
* Projects panel — one compact line per project, launch icons right + hover ([8ecf7d1](https://github.com/joeseverino/severino-obsidian/commit/8ecf7d128a07e60c2b6d66cfdfbe7eca49c95161))

## 1.0.0 (2026-06-16)


### Features

* local git hooks — pre-commit blocks main, pre-push gates ([#3](https://github.com/joeseverino/cordon-starter/issues/3)) ([80fcd30](https://github.com/joeseverino/cordon-starter/commit/80fcd30456a035e4cba37ebbcc62652995aaf1e2))
* self-documenting cordon.checks.json + check.sh report() redesign ([#9](https://github.com/joeseverino/cordon-starter/issues/9)) ([a420db9](https://github.com/joeseverino/cordon-starter/commit/a420db9bdc69af3d539bbb74a24abde1f17d391c))
* single-source verification gate + commit-msg hook ([#4](https://github.com/joeseverino/cordon-starter/issues/4)) ([bcea631](https://github.com/joeseverino/cordon-starter/commit/bcea631970a3c067c3cbe4b98b76bc8080ed753c))
* validate against cordon itself via $CORDON_HOME (drop vendored schema) ([#5](https://github.com/joeseverino/cordon-starter/issues/5)) ([eca96e1](https://github.com/joeseverino/cordon-starter/commit/eca96e173f3d668425764a304860c816fe18830a))
* wire scripts/check.sh to cordon's repo-checks runner ([#7](https://github.com/joeseverino/cordon-starter/issues/7)) ([0233388](https://github.com/joeseverino/cordon-starter/commit/023338861e466a0c40d49732edc2c5aa72500430))


### Bug Fixes

* self-contained CI + hardened governance, add smoke test ([d3c0ed3](https://github.com/joeseverino/cordon-starter/commit/d3c0ed30ac052adae8a8325f31dd8e1e4157c482))

## [Unreleased]

### Changed
- **Checks engine model documented.** The `run_checks` gate step now runs
  cordon's full checks *engine*: built-in invariants plus this repo's own
  `commands[]` specs (a test suite, a type check, a bespoke audit — declared as
  data in `cordon.checks.json`, spec code stays home), folded into one verdict.
  Each check is capability-gated (`requires` git/macos/built-dir/`<binary>`, with
  `!` negation), so the scaffold is lean by default and skips fail-soft what the
  environment can't satisfy. `cordon.checks.json` ships an explicit `commands: []`
  (schema-autocompleted) alongside the off-by-default `idempotence`. See AGENTS.md
  → "Repo checks config" and CORNERSTONES.md → CI.

### Added
- Initial scaffold: Cordon emit-once example tool, CI conformance gate,
  `scripts/check.sh` pre-push gate, `scripts/setup-governance.sh` branch
  protection + security, AGENTS.md cornerstone playbook, optional design tokens.

  Targets Cordon `schema_version: 4`.
