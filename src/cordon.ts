import { runToolJson } from './exec';

// D — lightweight cordon effect awareness. The plugin derives each action's
// blast radius from the SAME cordon contract the AI agent reads
// (`tools describe --repos`), rather than hardcoding it. For a single-user flow
// this adds zero friction: only remote_write / deploy prompt; everything at or
// below vault_write just runs. The effect is also surfaced as a chip so you see
// the blast radius before acting — the same signal, third face.

export type Effect = 'read' | 'local_write' | 'vault_write' | 'remote_write' | 'deploy' | 'unknown';

const RANK: Record<Effect, number> = {
  read: 0,
  local_write: 1,
  vault_write: 2,
  remote_write: 3,
  deploy: 4,
  unknown: -1,
};

const CONFIRM_AT = RANK.remote_write;

let cache: Map<string, string> | null = null;

// Walk the federated contract collecting every {name, effect} pair, keyed by
// both the bare command name and "<tool> <command>", so lookups are robust to
// the exact nesting (tools[].commands[], siblings, …).
function collect(node: unknown, parent: string, map: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, parent, map);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name : undefined;
  const effect = typeof obj.effect === 'string' ? obj.effect : undefined;
  if (name && effect) {
    map.set(name, effect);
    if (parent) map.set(`${parent} ${name}`, effect);
  }
  const nextParent = name ?? parent;
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'name' || key === 'effect') continue;
    collect(value, nextParent, map);
  }
}

async function loadEffects(vaultRoot: string): Promise<Map<string, string>> {
  if (cache) return cache;
  const map = new Map<string, string>();
  const res = await runToolJson('tools', ['describe', '--repos'], { cwd: vaultRoot });
  if (res.ok && res.data) collect(res.data, '', map);
  cache = map;
  return map;
}

export async function effectFor(tool: string, command: string, vaultRoot: string): Promise<Effect> {
  const map = await loadEffects(vaultRoot);
  const found = map.get(`${tool} ${command}`) ?? map.get(command) ?? map.get(tool);
  return (found as Effect | undefined) ?? 'unknown';
}

export function needsConfirm(effect: Effect): boolean {
  return RANK[effect] >= CONFIRM_AT;
}
