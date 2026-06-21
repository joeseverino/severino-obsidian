import { runToolJson } from './exec';

// B — the plugin never hardcodes the frontmatter schema. It derives the
// canonical enums from `severino-vault-mcp schema` (the single source HQ, the
// site, and the vault schema doc all validate against), so the plugin can't
// become a drifting extra surface.

export interface VaultSchema {
  doc_id_prefixes: string[];
  doc_types: string[];
  environments: string[];
  required_fields: string[];
  sensitivities: string[];
  statuses: string[];
}

let cache: VaultSchema | null = null;

export async function fetchSchema(vaultRoot: string): Promise<VaultSchema | null> {
  if (cache) return cache;
  const res = await runToolJson<VaultSchema>('severino-vault-mcp', ['schema'], {
    cwd: vaultRoot,
    env: { SVMC_VAULT_PATH: vaultRoot },
  });
  if (res.ok && res.data) cache = res.data;
  return cache;
}

export interface FrontmatterLint {
  ok: boolean;
  missingRequired: string[];
  invalidEnums: string[];
}

// Check an indexed doc's frontmatter against the canonical schema: required
// fields present, enum-typed fields within their allowed sets.
export function lintFrontmatter(
  frontmatter: Record<string, unknown>,
  schema: VaultSchema,
): FrontmatterLint {
  const missingRequired = schema.required_fields.filter((field) => {
    const value = frontmatter[field];
    return value === undefined || value === null || value === '';
  });

  const enumFields: ReadonlyArray<[string, string[]]> = [
    ['doc_type', schema.doc_types],
    ['environment', schema.environments],
    ['sensitivity', schema.sensitivities],
    ['status', schema.statuses],
  ];
  const invalidEnums: string[] = [];
  for (const [field, allowed] of enumFields) {
    const value = frontmatter[field];
    if (typeof value === 'string' && value && !allowed.includes(value)) {
      invalidEnums.push(`${field}: ${value} (not in ${allowed.join(' / ')})`);
    }
  }

  return { ok: !missingRequired.length && !invalidEnums.length, missingRequired, invalidEnums };
}
