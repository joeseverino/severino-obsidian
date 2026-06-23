# Architecture

`severino-obsidian` is the **editor-side face** of the Severino Labs system,
beside AI sessions, shell CLIs, TUIs, and downstream views (HQ, the site,
Bases). Its design is one sentence:

> **The plugin owns nothing but the UI.** Every fact it shows is derived from an
> owner, and every change it makes goes through that owner. It renders and it
> delegates — it never computes **system truth**, never validates canonical
> data, and never writes vault data directly. (It does, of course, compute *UI*
> state: context, filtering, command-palette display, detached-DOM rendering.)

If a feature would re-implement something another part of the fleet already owns,
it is out by design. That single rule is what keeps a growing plugin from
becoming a second, drifting source of truth.

---

## The owners it derives from

The fleet already has the hard parts. The plugin is glue over three **primary**
owners — the MCP, the site, and the brand kit — and reaches every other fleet
tool (`site`, `tools`, `diagram`, `backlog`) only through the same CLI bridge:

| Owner | What it owns | The plugin consumes it via |
|---|---|---|
| **`severino-vault-mcp`** (the MCP) | the vault brain — all task logic, the frontmatter schema, search, vault state, the one atomic writer | shells out to its **CLI subcommands** (below) |
| **`jseverino.com`** (the site) | markdown→HTML rendering (incl. the block DSL), `base.css`, the publish contract | esbuild **aliases** bundle the real files at build time |
| **`severino-brand`** (the brand kit) | the identity — tokens, the JS monogram mark | the mark is bundled (`@site/brand-mark`); brand vars ride in via the site's `base.css` |

Nothing here is re-implemented. The renderer is imported, not forked. The schema
enums come from `schema --json`, not a hardcoded list. The logo is the kit's
`mark.svg`, bundled, not redrawn.

---

## The one bridge: `src/exec.ts`

Everything the plugin "knows" beyond Obsidian's own API comes through one bridge.
`exec.ts` shells out to the fleet CLIs the AI and the shell already use
(`severino-vault-mcp`, `site`, `brand`, `diagram`, `tools`) and consumes their
JSON. It resolves binaries to `~/.local/bin` and augments `PATH`, because Obsidian
is GUI-launched and inherits a minimal environment.

```
runTool(bin, args, opts)        → { ok, stdout, stderr }
runToolJson<T>(bin, args, opts) → { ok, data?: T, error? }
```

Two functions. Every panel, command, and modal is built on them. There is no
second way the plugin reaches the rest of the system.

**Failure is honest.** If an owner is unavailable — the MCP isn't installed, a
CLI errors — the bridge surfaces the error and the panel renders it inline. The
plugin never silently falls back to a reimplementation; a missing owner is a
visible error, not a quietly wrong answer.

---

## The MCP subcommand surface it consumes

The plugin is a thin client over the MCP. It calls these subcommands and renders
what they return — **it holds none of the logic behind them**:

**Reads** (derive what to show):

| Subcommand | Used by |
|---|---|
| `task-list [--project X]` | the Backlog panel (open work + scoped `shipped` feed), the status badge |
| `task-projects` | the New-task modal picker, the Projects panel (slugs + open counts) |
| `brief --days 7` | the Vault panel (docs to review), the status badge (open · stale · inbox) |
| `list-writeups` | the Writeups panel (drafts / published) |
| `find <q>` | "Ask the vault" (the runbook-search quick-switcher) |
| `schema` | the relation editor's enum options (status / sensitivity per doc type) |
| `validate-writeup --draft` | the publish gate |

**Writes** — and this is the discipline: **the plugin never edits vault
frontmatter directly.** Every mutation is an MCP subcommand, so the MCP stays the
single schema-validated, atomic writer:

| Subcommand | Used by | Why it's the MCP, not the plugin |
|---|---|---|
| `task-add` | the New-task modal | slug, colocation in `01 Projects/<p>/tasks/`, body, validation |
| `promote-note` | inbox triage / the promote command | reads the note's body, creates the task, deletes the source |
| `update-frontmatter` | the relation editor | enum + relation fields validated against the schema |
| `task-reconcile` | the cockpit (on open / Refresh) | files closed tasks into `tasks/done/`, catching hand edits |
| `backfill-aliases` | the Vault panel's one-click fix | repairs folder-note aliases |

The only writes the plugin does *itself* are **Obsidian-native file operations**
(creating a note isn't its job; opening one and `fileManager.renameFile` for
archive are — those are vault-structure actions Obsidian legitimately owns).

---

## The cockpit: an extensible, derive-only shell

`src/cockpit-view.ts` is a tabbed Obsidian `ItemView` that hosts a **panel
registry**. Each panel implements one small contract:

```ts
interface CockpitPanel {
  id: string;
  title: string;
  render(body: HTMLElement, ctx: CockpitContext): Promise<void>;
}
```

The shell owns only the chrome (the brand-mark header, the tabs, the
context bar, the scroll region) and the seams a panel needs (`openFile`,
`newTask`, `promoteNote`, `archiveNote`, `refresh`). A panel derives its data
from the MCP and paints it; **adding a panel is appending to the registry — the
shell does not change.** Today: Backlog · Projects · Writeups · Vault.

Three properties make it feel native and stay clean:

- **Context-aware.** A thin context bar reflects the active file — a writeup gets
  an *Open preview* button, a project doc gets its launch buttons. The Backlog
  panel scopes to the project you're in (with a Project/All toggle).
- **No-flash rendering.** A panel builds into a detached node and is swapped in
  atomically, so it never blanks while its `runToolJson` call resolves.
- **Quiet auto-refresh.** It re-renders on vault changes (debounced) and only
  when the active *project* actually changes — clicking around doesn't churn.

The launch buttons (Finder / VS Code / iTerm / GitHub) derive a project's repo
path from its `project_path` frontmatter and shell `open` / `git remote` — the
one place the plugin runs a non-fleet command, and even then the *data* is
frontmatter that already exists.

---

## The command surface — one declaration, three renders

Every Obsidian command is declared **once** in `src/commands.mjs`. That single
array drives:

1. the live command registrations (`src/main.ts`),
2. the **cordon-v4 contract** (`contract/obsidian-commands.json`, via
   `npm run commands:emit`) — making this a conformant cordon emitter beside the
   Bash (`tools`) and Python (MCP) ones,
3. the README's command reference (generated, gate-checked).

Each command carries an `effect` (`read < local_write < vault_write <
remote_write < deploy`) and the fleet command it `delegates` to, so the plugin's
blast radius federates into the one fleet contract and the same `--describe`
risk-gating the rest of the fleet uses.

---

## The build: consume at compile time

`esbuild.config.mjs` (+ `scripts/site-paths.mjs`) bundles the owners' real files
via aliases and writes the plugin straight into the vault's
`.obsidian/plugins/severino-obsidian/`:

```
@site/markdown    → jseverino.com/src/lib/markdown.ts   (the renderer)
@site/base-css    → jseverino.com/src/styles/base.css   (text loader)
@site/brand-mark  → public/assets/brand/mark.svg        (the JS monogram)
@site/inter-font  → the Inter woff2                      (dataurl loader)
```

So even the bundled assets are *consumed from their owner*, not copied into this
repo. Edit `base.css` or the brand mark at the source and a rebuild picks it up.

---

## Why this can't drift

- **One brain.** Task logic lives in the MCP. The CLI board, `Backlog.base`, and
  the cockpit are three faces of the same `task-list`; close a task anywhere and
  all three agree, because none of them re-derive status.
- **One writer.** Vault writes go through MCP subcommands, validated against one
  schema. The plugin can't write a malformed task.
- **One schema.** Enum options come from `schema --json` (the same source HQ and
  the site validate against) — never a list the plugin maintains.
- **One renderer, one identity.** The writeup preview is the site's own
  `renderWriteupHtml` + `base.css`; the logo is the brand kit's mark.

The plugin is the *interface* to the system, not a part of the system's logic.
That is the whole design, and it's what lets it grow without becoming a liability.

See [CORNERSTONES.md](./CORNERSTONES.md) for the repo-governance standards every
Severino repo carries.
