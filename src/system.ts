import { runTool, runToolJson, ToolResult } from './exec';

// Bridges to the rest of the system by invoking the same CLIs the `site` TUI and
// AI sessions use. The plugin is a third face of one code path — it never
// reimplements validation, the catalog, or sync.

const MCP = 'severino-vault-mcp';

function mcpEnv(vaultRoot: string): Record<string, string> {
  return { SVMC_VAULT_PATH: vaultRoot };
}

// ── Publish gate (consumes `severino-vault-mcp validate-writeup`, added in A) ──

export interface GateReport {
  ok: boolean;
  blockers: string[];
  missingTechSlugs: string[];
  missingImages: string[];
  unresolvedRefs: string[];
  nits: string[];
  error?: string;
}

interface RawValidate {
  ok?: boolean;
  error?: string;
  blockers?: string[];
  missing_tech_slugs?: string[];
  missing_images?: string[];
  unresolved_refs?: string[];
  nits?: string[];
}

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
  const args = ['validate-writeup', slug];
  if (draft) args.push('--draft');
  const res = await runToolJson<RawValidate>(MCP, args, { cwd: vaultRoot, env: mcpEnv(vaultRoot) });
  if (!res.ok || !res.data) return emptyGate(res.error ?? 'gate failed to run');
  const d = res.data;
  if (d.error) return emptyGate(d.error);
  return {
    ok: d.ok === true,
    blockers: d.blockers ?? [],
    missingTechSlugs: d.missing_tech_slugs ?? [],
    missingImages: d.missing_images ?? [],
    unresolvedRefs: d.unresolved_refs ?? [],
    nits: d.nits ?? [],
  };
}
