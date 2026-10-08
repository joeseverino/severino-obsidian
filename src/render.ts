// The preview document comes whole from the site: `site render - --document`
// renders the unsaved buffer in the site's article layout with its styles
// inlined. The plugin owns none of the markup or styling; it only points the
// document's vault-relative asset paths at local files.
//
import { runToolJson } from './exec.ts';
import { isBoolean, isString, optional, shape } from './guards.ts';

export interface RenderInput {
  markdown: string;
  slug: string;
  resolveAsset: (rel: string) => string | null;
  /** Renders the full preview page; defaults to the site CLI. */
  renderDocument?: (markdown: string) => Promise<string>;
  /** Vault root the site CLI reads from; required by the default renderDocument. */
  vaultRoot?: string;
}

export const isSiteRender = shape({
  ok: optional(isBoolean),
  document: optional(isString),
  error: optional(shape({ message: optional(isString) })),
});

export function siteRenderDocument(vaultRoot: string): (markdown: string) => Promise<string> {
  return async (markdown) => {
    const res = await runToolJson('site', ['render', '-', '--document', '--json'], isSiteRender, {
      cwd: vaultRoot,
      env: { VAULT_DIR: vaultRoot },
      input: markdown,
    });
    if (!res.ok || !res.data) throw new Error(res.error ?? 'site render failed to run');
    if (!res.data.ok || typeof res.data.document !== 'string') throw new Error(res.data.error?.message ?? 'site render failed');
    return res.data.document;
  };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Point asset URLs back at local vault files: the site form
// (/assets/writeups/<slug>/...) and the folder-relative form (./images/...)
// the raw vault markdown renders with.
function rewriteAssets(html: string, slug: string, resolve: (rel: string) => string | null): string {
  const base = `/assets/writeups/${slug}/`;
  const local = (whole: string, pre: string, rel: string, post: string): string => {
    const found = resolve(rel);
    return found ? `${pre}${found}${post}` : whole;
  };
  return html
    .replace(new RegExp(`((?:src|href)=")${escapeRegExp(base)}([^"]+)(")`, 'g'), local)
    .replace(/((?:src|href)=")(?:\.\/)?((?![a-z][a-z0-9+.-]*:|\/|#)[^"]+)(")/gi, local);
}

const errorDoc = (err: unknown): string =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>' +
  `<pre style="white-space:pre-wrap;color:#991b1b;font-family:monospace;padding:1rem">Preview failed to render:\n${escapeHtml(String(err))}</pre>` +
  '</body></html>';

export async function buildPreviewDoc(input: RenderInput): Promise<string> {
  const render = input.renderDocument ?? siteRenderDocument(input.vaultRoot ?? '');
  try {
    return rewriteAssets(await render(input.markdown), input.slug, input.resolveAsset);
  } catch (err) {
    return errorDoc(err);
  }
}
