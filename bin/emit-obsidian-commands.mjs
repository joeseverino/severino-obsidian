#!/usr/bin/env node
// E — emit the plugin's Obsidian command surface as a cordon-v4 contract from
// the single source src/commands.mjs. The same array registers the live
// commands (src/main.ts) and renders this contract: emit once, derive
// everywhere. This is the plugin's runtime surface (what it DOES in Obsidian),
// distinct from contract/severino-obsidian.json (how the repo is BUILT).
//
//   node bin/emit-obsidian-commands.mjs           write contract/obsidian-commands.json
//   node bin/emit-obsidian-commands.mjs --check    exit 1 if the committed file is stale
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { OBSIDIAN_COMMANDS } = await import(
  pathToFileURL(path.join(repoRoot, 'src/commands.mjs')).href
);

const EFFECTS = ['read', 'local_write', 'vault_write', 'remote_write', 'deploy'];

// Keep the contract honest: every spec must be well-formed before we emit.
for (const command of OBSIDIAN_COMMANDS) {
  if (!command.id || !command.name || !EFFECTS.includes(command.effect)) {
    console.error(`invalid command spec: ${JSON.stringify(command)}`);
    process.exit(1);
  }
}

const doc = {
  ok: true,
  schema_version: 4,
  name: 'severino-obsidian-commands',
  description: 'Severino Labs Obsidian plugin — in-editor command surface.',
  group: 'Integrations',
  order: 161,
  effect: 'read',
  global_options: [],
  positionals: [],
  paras: [
    'Runtime commands invoked from Obsidian’s command palette; each carries a ' +
      'cordon effect (read < local_write < vault_write < remote_write < deploy) ' +
      'so the fleet sees its blast radius. Rendered from src/commands.mjs — the ' +
      'same array that registers the live commands.',
  ],
  examples: [],
  commands: OBSIDIAN_COMMANDS.map((command) => {
    // cordon-v4 command object: required name/summary/args/effect/paras/examples,
    // optional delegates. No extra keys (additionalProperties: false).
    const entry = {
      name: command.id,
      summary: `${command.name} — ${command.summary}`,
      args: [],
      effect: command.effect,
      paras: [],
      examples: [],
    };
    if (command.delegate) entry.delegates = command.delegate;
    return entry;
  }),
};

const out = path.join(repoRoot, 'contract/obsidian-commands.json');
const rendered = `${JSON.stringify(doc, null, 2)}\n`;
const existing = await readFile(out, 'utf8').catch(() => '');

if (process.argv.includes('--check')) {
  if (existing !== rendered) {
    console.error('contract/obsidian-commands.json is stale — run `npm run commands:emit`');
    process.exit(1);
  }
  console.log('ok: obsidian-commands contract in sync');
} else {
  await writeFile(out, rendered);
  console.log(`wrote contract/obsidian-commands.json (${doc.commands.length} commands)`);
}
