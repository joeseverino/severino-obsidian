// The renderer glue. The plugin owns NONE of the markdown→HTML logic or the
// styling: it calls the site's own renderWriteupHtml, injects the site's own
// styles via previewStyles (base.css + brand vars + font — the "load BOTH"
// contract owned by the site), and reproduces the article page STRUCTURE that
// portfolio/[slug]/index.astro emits so those styles actually apply. All inputs
// come from the real owners via esbuild aliases (see esbuild.config.mjs).
//
import { renderWriteupHtml } from '@site/markdown';
import { parseFrontmatter } from '@site/frontmatter';
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

// Point site asset URLs (/assets/writeups/<slug>/…) back at local vault files.
function rewriteAssets(html: string, slug: string, resolve: (rel: string) => string | null): string {
  const base = `/assets/writeups/${slug}/`;
  return html.replace(
    new RegExp(`((?:src|href)=")${escapeRegExp(base)}([^"]+)(")`, 'g'),
    (whole, pre: string, rel: string, post: string) => {
      const local = resolve(rel);
      return local ? `${pre}${local}${post}` : whole;
    },
  );
}

export function buildPreviewDoc(input: RenderInput): string {
  const { markdown, slug, title, date, coverImage, coverAlt, technologies, resolveAsset } = input;

  let body: string;
  try {
    body = renderWriteupHtml(parseFrontmatter(markdown).content, slug);
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
