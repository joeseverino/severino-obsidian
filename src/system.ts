import { runTool, runToolJson, type ToolResult } from './exec.ts';
import { arrayOf, isBoolean, isString, optional, shape } from './guards.ts';

// Bridges to the rest of the system by invoking the same CLIs the `site` TUI and
// AI sessions use. The plugin is a third face of one code path — it never
// reimplements validation, the catalog, or sync.


// ── Publish gate (consumes `site validate --json`) ──

export interface GateReport {
  ok: boolean;
  blockers: string[];
  missingTechSlugs: string[];
  missingImages: string[];
  unresolvedRefs: string[];
  nits: string[];
  error?: string;
}

const isRawValidate = shape({
  ok: optional(isBoolean),
  documents: optional(arrayOf(shape({ slug: isString, issues: arrayOf(isString) }))),
  error: optional(shape({ message: optional(isString) })),
});

const emptyGate = (error: string): GateReport => ({
  ok: false,
  blockers: [],
  missingTechSlugs: [],
  missingImages: [],
  unresolvedRefs: [],
  nits: [],
  error,
});

// ── Sync to site repo (consumes `site sync`) ─────────────────────────────────

export async function syncToSite(vaultRoot: string): Promise<ToolResult> {
  // `site` reads its own config for paths; just give it the vault as cwd.
  return runTool('site', ['sync'], { cwd: vaultRoot });
}

export async function gateWriteup(slug: string, vaultRoot: string, draft = true): Promise<GateReport> {
  const args = ['validate', slug, '--json'];
  if (draft) args.push('--draft');
  const res = await runToolJson('site', args, isRawValidate, { cwd: vaultRoot, env: { VAULT_DIR: vaultRoot } });
  if (!res.ok || !res.data) return emptyGate(res.error ?? 'gate failed to run');
  const d = res.data;
  const blockers = (d.documents ?? []).flatMap((doc) => doc.issues);
  if (!d.ok && blockers.length === 0) return emptyGate(d.error?.message ?? 'gate failed');
  return { ok: d.ok === true, blockers, missingTechSlugs: [], missingImages: [], unresolvedRefs: [], nits: [] };
}
