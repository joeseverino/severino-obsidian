// E — the plugin's Obsidian command surface, defined ONCE. This single source
// drives both the live command registrations (src/main.ts) and the cordon-v4
// contract (bin/emit-obsidian-commands.mjs → contract/obsidian-commands.json).
// Plain .mjs so the Node emitter and the bundled plugin import the same array.
//
// Each command carries a cordon `effect` (read < local_write < vault_write <
// remote_write < deploy) — the same blast-radius signal the rest of the fleet
// uses, so the plugin's runtime surface federates into the one contract.
//
// type: "callback" (no editor needed) | "editor" (acts on the active editor).

export const OBSIDIAN_COMMANDS = [
  { id: 'open-site-preview', name: 'Site preview: open pane', effect: 'read', group: 'Preview', type: 'callback', summary: 'Open the site-accurate writeup preview pane.' },
  { id: 'publish-gate', name: 'Publish gate: check this writeup', effect: 'read', group: 'Writeup', type: 'callback', summary: 'Run the MCP validate-writeup gate (draft mode).', delegate: 'severino-vault-mcp validate-writeup --draft' },
  { id: 'asset-doctor', name: 'Asset doctor: check images for orphans + missing', effect: 'read', group: 'Writeup', type: 'callback', summary: 'Report orphaned and missing writeup images.' },
  { id: 'insert-figure', name: 'Insert figure block', effect: 'local_write', group: 'Authoring', type: 'editor', summary: 'Insert a ::figure DSL skeleton at the cursor.' },
  { id: 'insert-table', name: 'Insert table block', effect: 'local_write', group: 'Authoring', type: 'editor', summary: 'Insert a ::table DSL skeleton at the cursor.' },
  { id: 'insert-terminal', name: 'Insert terminal block', effect: 'local_write', group: 'Authoring', type: 'editor', summary: 'Insert a ::terminal DSL skeleton at the cursor.' },
  { id: 'graphics-status', name: 'Graphics: status (unrendered sources)', effect: 'read', group: 'Graphics', type: 'callback', summary: 'List graphics sources vs rendered images.' },
  { id: 'graphics-render', name: 'Graphics: render unrendered into images/', effect: 'local_write', group: 'Graphics', type: 'callback', summary: 'Render graphics via brand/diagram into images/.', delegate: 'brand figure / diagram' },
  { id: 'sync-to-site', name: 'Sync writeups to the site repo', effect: 'vault_write', group: 'Publish', type: 'callback', summary: 'Run `site sync` (vault → site repo).', delegate: 'site sync' },
  { id: 'schema-check', name: 'Schema: check this doc’s frontmatter', effect: 'read', group: 'Docs', type: 'callback', summary: 'Lint frontmatter against the MCP schema.', delegate: 'severino-vault-mcp schema' },
  { id: 'open-on-site', name: 'Open writeup on jseverino.com', effect: 'read', group: 'Publish', type: 'callback', summary: 'Open the live writeup URL in the browser.' },
  { id: 'copy-slug', name: 'Copy writeup slug', effect: 'read', group: 'Writeup', type: 'callback', summary: 'Copy the active writeup slug to the clipboard.' },
  { id: 'new-task', name: 'New task', effect: 'vault_write', group: 'Backlog', type: 'callback', summary: 'Create a task (title + project picker) via the MCP, then open it.', delegate: 'severino-vault-mcp task-add' },
  { id: 'open-cockpit', name: 'Cockpit: open', effect: 'read', group: 'Cockpit', type: 'callback', summary: 'Open the fleet cockpit panel (backlog + stale debt, derived from the MCP).' },
  { id: 'ask-the-vault', name: 'Ask the vault', effect: 'read', group: 'Vault', type: 'callback', summary: 'Quick-switcher over the MCP find_runbook ranking; opens the hit.', delegate: 'severino-vault-mcp find' },
  { id: 'edit-relations', name: 'Edit relations', effect: 'vault_write', group: 'Docs', type: 'callback', summary: 'Edit related_projects + status/sensitivity from the registry/schema; writes via the MCP.', delegate: 'severino-vault-mcp update-frontmatter' },
  { id: 'promote-note', name: 'Promote inbox note to a task', effect: 'vault_write', group: 'Backlog', type: 'callback', summary: 'Promote the active inbox note into a task (body preserved) via the MCP, then open it.', delegate: 'severino-vault-mcp promote-note' },
  { id: 'autopopulate-daily', name: 'Daily note: populate brief region', effect: 'vault_write', group: 'Daily', type: 'callback', summary: 'Fill today’s daily-note brief region (work to ship, review-due, stale backlog, drafts) via `vault daily`. Also fires once when today’s daily note opens.', delegate: 'vault daily' },
];
