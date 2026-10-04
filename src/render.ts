// The renderer glue. The plugin owns none of the markdown-to-HTML logic or the
// styling: the body comes from the site's own `site render`, the styles from
// the site's previewStyles (base.css, brand vars, font), and this file
// reproduces the article page structure portfolio/[slug]/index.astro emits so
// those styles apply. Styles arrive via esbuild aliases (esbuild.config.mjs).
//
import { runToolJson } from './exec';
import { previewStyles } from '@site/web-styles';
import siteBaseCss from '@site/base-css';
import interFontUrl from '@site/inter-font';

export interface RenderInput {
  markdown: string;
  slug: string;
  title: string;
  date?: string;
  coverImage?: string;
  coverAlt?: string;
  technologies?: string[];
  resolveAsset: (rel: string) => string | null;
  /** Renders the markdown body; defaults to the site CLI. */
  renderBody?: (markdown: string) => Promise<string>;
  /** Vault root the site CLI reads from; required by the default renderBody. */
  vaultRoot?: string;
}

interface SiteRender {
  ok?: boolean;
  html?: string;
  error?: { message?: string };
}

// The site renders the unsaved buffer (`-` reads stdin), so the preview tracks
// live edits without the plugin bundling the renderer.
export function siteRenderBody(vaultRoot: string): (markdown: string) => Promise<string> {
  return async (markdown) => {
    const res = await runToolJson<SiteRender>('site', ['render', '-', '--json'], {
      cwd: vaultRoot,
      env: { VAULT_DIR: vaultRoot },
      input: markdown,
    });
    if (!res.ok || !res.data) throw new Error(res.error ?? 'site render failed to run');
    if (!res.data.ok || typeof res.data.html !== 'string') throw new Error(res.data.error?.message ?? 'site render failed');
    return res.data.html;
  };
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (s: string): string => escapeHtml(s).replace(/"/g, '&quot;');

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "2026-06-17" → "JUNE 17, 2026" (matches the article-date styling).
function formatDate(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d
    .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}

// "cloudflare-pages" → "Cloudflare Pages"
const titleCase = (slug: string): string =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

export async function buildPreviewDoc(input: RenderInput): Promise<string> {
  const { markdown, slug, title, date, coverImage, coverAlt, technologies, resolveAsset } = input;
  const renderBody = input.renderBody ?? siteRenderBody(input.vaultRoot ?? '');

  let body: string;
  try {
    body = await renderBody(markdown);
  } catch (err) {
    body = `<pre class="svo-error">Preview failed to render:\n${escapeHtml(String(err))}</pre>`;
  }
  body = rewriteAssets(body, slug, resolveAsset);

  // Article header / hero / tags — same structure as portfolio/[slug]/index.astro.
  const heroSrc = coverImage ? resolveAsset(coverImage.replace(/^\.?\//, '')) : null;
  const hero = heroSrc
    ? `<figure class="article-hero"><img src="${escapeAttr(heroSrc)}" alt="${escapeAttr(coverAlt ?? '')}"></figure>`
    : '';
  const dateHtml = date
    ? `<p class="article-date"><time datetime="${escapeAttr(date)}">${formatDate(date)}</time></p>`
    : '';
  const tags = (technologies ?? []).filter(Boolean);
  const tagsFooter = tags.length
    ? `<footer class="article-tags"><h3>Technologies Used</h3><div class="tech-pills">${tags
        .map((t) => `<a href="#" rel="tag">${escapeHtml(titleCase(t))}</a>`)
        .join('')}</div><hr class="article-separator"></footer>`
    : '';

  const head = [
    // The site's "load BOTH" bundle: base.css + brand vars + a resolvable Inter
    // @font-face (base.css's font URL is absolute and can't resolve in the iframe,
    // so we hand previewStyles the inlined woff2). One call, owned by the site, so
    // the brand vars can never be forgotten here.
    previewStyles({ baseCss: siteBaseCss, fontUrl: interFontUrl }),
    '<style>',
    '  html { color-scheme: light; }',
    '  body { margin: 0; background: var(--color-bg, #fff); }',
    '  main.article { padding: 2rem var(--gutter, 1.5rem) 3rem; }',
    '  .svo-error { white-space: pre-wrap; color: #991b1b; font-family: var(--font-mono, monospace); padding: 1rem; }',
    '</style>',
  ].join('\n');

  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    head,
    '</head><body>',
    '<main class="article">',
    `<header class="article-header"><div class="article-meta"><h1 class="article-title">${escapeHtml(title)}</h1>${dateHtml}</div>${hero}</header>`,
    '<article class="prose">',
    body,
    '</article>',
    tagsFooter,
    '</main>',
    '</body></html>',
  ].join('\n');
}
