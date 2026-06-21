# severino-obsidian

The editor-side surface for the Severino Labs vault: an Obsidian plugin that
previews writeups **exactly as `jseverino.com` renders them**, plus a few
lightweight authoring power-ups.

It is built on one principle — **own almost nothing**. The hard parts already
have owners; this plugin is Obsidian glue that consumes them:

| Concern | Owner (single source of truth) | How this plugin uses it |
|---|---|---|
| markdown → HTML, incl. the `::figure` / `::table` / `::terminal` DSL | `jseverino.com/src/lib/markdown.ts` | imports `renderWriteupHtml` (esbuild alias) — never reimplemented |
| brand tokens + writeup CSS | `severino-brand/brand/tokens.json` → site `base.css` (token-synced) | injects `base.css` into the preview iframe |
| writeup validation / publish prep | `severino-vault-mcp` | surfaces read-only gate state; defers authority |
| repo governance, command contract, CI | `cordon-starter` + `cordon` | standard cornerstones |

If a feature would re-implement another owner's piece, it's out by design.

## Features

- **Site preview pane** — live, sandboxed iframe rendering the active writeup
  with the site's own renderer + CSS. `./images/` resolve to local files, so
  drafts preview without running `dev:drafts`.
- **Publish gate** — runs `severino-vault-mcp validate-writeup --draft` and
  surfaces blockers / unknown tags / missing images / unresolved refs / nits.
- **Asset doctor** — reports orphaned images (in `images/` but unreferenced) and
  broken refs (referenced but missing), enforcing the orphan-free `images/` rule.
- **Graphics: status / render** — finds `graphics/*.figure.json` / `*.mmd` that
  aren't rendered into `images/` yet, and renders them via `brand figure` /
  `diagram`.
- **Schema check** — lints an indexed doc's frontmatter against the MCP's
  canonical `schema` (the single source HQ and the site validate against).
- **Sync to site** — runs `site sync` so a build / `astro dev` reflects vault edits.
- **Gate badge** — a status-bar pill showing `published` / `featured` /
  `published_at` for the active writeup.
- **DSL inserts** — `Insert figure / table / terminal block` commands that drop
  the site's block-DSL skeleton (and wrap a selection if you have one).
- **Open on site / copy slug** — jump to `jseverino.com/portfolio/<slug>/`.

Writeup commands are scoped to `05 Writeups/<slug>/index.md`; the schema check
applies to indexed docs under `01/02/03`.

## Effects & the cordon contract

The command surface is declared once in `src/commands.mjs` and rendered into both
the live commands and a **cordon-v4 contract** (`contract/obsidian-commands.json`,
`npm run commands:emit`) — making this a third conformant cordon emitter beside
the Bash (`tools`) and Python (MCP) ones. Each command carries its `effect`
(`read < local_write < vault_write < remote_write < deploy`) and the fleet
command it `delegates` to. The plugin derives the same effects from
`tools describe --repos` to risk-gate at runtime: only `remote_write` / `deploy`
prompt, so a single-user flow is friction-free.

## Develop

The build bundles the site renderer + `base.css` and writes the plugin straight
into the vault. Paths are overridable (same pattern as `severino-brand/sync.mjs`):

```sh
npm install
npm run build        # one-shot bundle → <vault>/.obsidian/plugins/severino-obsidian/
npm run dev          # watch mode

# overrides
SITE_DIR=/path/to/jseverino.com VAULT_DIR="/path/to/Severino Labs" npm run build
```

Then in Obsidian: **Settings → Community plugins → enable "Severino Labs"**
(reload the list if it doesn't appear). Open a writeup and run
**Site preview: open pane**.

## Governance

The command surface is derived from `package.json` scripts via the cordon emitter
(`bin/severino-obsidian`); each command's blast radius lives in
`contract/severino-obsidian.json`. Regenerate after a scripts change with
`npm run describe:write`. The reference below is rendered from that contract by
`scripts/gen-readme.mjs` and gate-checked — don't hand-edit it.

<!-- BEGIN GENERATED: cli-reference (scripts/gen-readme.mjs — do not edit by hand) -->

### `severino-obsidian`

effect: `read`

Obsidian plugin suite for the vault: site-accurate writeup preview + authoring power-ups.

**Commands**

| command | effect | summary |
|---|---|---|
| `build` | `local_write` |  |
| `dev` | `local_write` |  |
| `typecheck` | `read` |  |
| `commands:emit` | `local_write` |  |
| `commands:check` | `read` |  |

---

### `severino-obsidian-commands`

effect: `read`

Severino Labs Obsidian plugin — in-editor command surface.

**Commands**

| command | effect | summary |
|---|---|---|
| `open-site-preview` | `read` | Site preview: open pane — Open the site-accurate writeup preview pane. |
| `publish-gate` | `read` | Publish gate: check this writeup — Run the MCP validate-writeup gate (draft mode). |
| `asset-doctor` | `read` | Asset doctor: check images for orphans + missing — Report orphaned and missing writeup images. |
| `insert-figure` | `local_write` | Insert figure block — Insert a ::figure DSL skeleton at the cursor. |
| `insert-table` | `local_write` | Insert table block — Insert a ::table DSL skeleton at the cursor. |
| `insert-terminal` | `local_write` | Insert terminal block — Insert a ::terminal DSL skeleton at the cursor. |
| `graphics-status` | `read` | Graphics: status (unrendered sources) — List graphics sources vs rendered images. |
| `graphics-render` | `local_write` | Graphics: render unrendered into images/ — Render graphics via brand/diagram into images/. |
| `sync-to-site` | `vault_write` | Sync writeups to the site repo — Run `site sync` (vault → site repo). |
| `schema-check` | `read` | Schema: check this doc’s frontmatter — Lint frontmatter against the MCP schema. |
| `open-on-site` | `read` | Open writeup on jseverino.com — Open the live writeup URL in the browser. |
| `copy-slug` | `read` | Copy writeup slug — Copy the active writeup slug to the clipboard. |

<!-- END GENERATED: cli-reference -->

## License

[MIT](LICENSE) © Joe Severino
