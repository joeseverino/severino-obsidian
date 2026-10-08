#!/usr/bin/env node
// E — emit the plugin's Obsidian command surface as a cordon-v4 contract from
// the single source src/commands.ts. The same array registers the live
// commands (src/main.ts) and renders this contract: emit once, derive
// everywhere. This is the plugin's runtime surface (what it DOES in Obsidian),
// distinct from contract/severino-obsidian.json (how the repo is BUILT).
//
//   node bin/emit-obsidian-commands.ts           write contract/obsidian-commands.json
//   node bin/emit-obsidian-commands.ts --check    exit 1 if the committed file is stale
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { EFFECTS, OBSIDIAN_COMMANDS } from '../src/commands.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');

// Keep the contract honest: every spec must be well-formed before we emit.
for (const command of OBSIDIAN_COMMANDS) {
  if (!command.id || !command.name || !EFFECTS.includes(command.effect)) {
    console.error(`invalid command spec: ${JSON.stringify(command)}`);
    process.exit(1);
  }
}

interface ContractCommand {
  name: string;
  summary: string;
  args: never[];
  effect: string;
  paras: never[];
  examples: never[];
  delegates?: string;
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
      'so the fleet sees its blast radius. Rendered from src/commands.ts — the ' +
      'same array that registers the live commands.',
  ],
  examples: [],
  commands: OBSIDIAN_COMMANDS.map((command) => {
    // cordon-v4 command object: required name/summary/args/effect/paras/examples,
    // optional delegates. No extra keys (additionalProperties: false).
    const entry: ContractCommand = {
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

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });

if (values.check) {
  if (existing !== rendered) {
    console.error('contract/obsidian-commands.json is stale — run `npm run commands:emit`');
    process.exit(1);
  }
  console.log('ok: obsidian-commands contract in sync');
} else {
  await writeFile(out, rendered);
  console.log(`wrote contract/obsidian-commands.json (${doc.commands.length} commands)`);
}
