// The renderer glue. The plugin owns none of the markdown→HTML logic or the
// styling: it runs the site's own Sätteri processorOptions, the site's own
// writeup body transforms (stripRepeatedDescription + stripArticleChrome, as the sync
// applies them), injects the site's styles via previewStyles (base.css + brand
// vars + font), and reproduces the article page structure that
// portfolio/[slug]/index.astro emits so those styles apply. All inputs come
// from the real owners via esbuild aliases (scripts/site-paths.mjs).
//
// The site compiles .mdx; the preview renders the same body with
// markdownToHtml and the same plugins, which yields the same markup. Only raw
// HTML differs: MDX parses it as JSX under the content guard, markdownToHtml
// passes it through verbatim. So the body is also compiled with mdxToJs, as
// `site validate` does, and any error the build would hit is shown above it.
import { markdownToHtml, mdxToJs } from '@site/satteri';
import { processorOptions } from '@site/markdown';
import { stripArticleChrome, stripRepeatedDescription } from '@site/writeup-body';
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

const firstLine = (err: unknown): string => String(err instanceof Error ? err.message : err).split('\n')[0] ?? '';

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

const isLocalRef = (url: string): boolean => !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url);

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// Point document-relative refs (./images/x.png) at local vault files. The site
// serves these through Astro's <Picture>; a plain <img> is enough here.
function rewriteAssets(html: string, resolve: (rel: string) => string | null): string {
  return html.replace(/((?:src|href)=")([^"]+)(")/g, (whole, pre: string, url: string, post: string) => {
    if (!isLocalRef(url)) return whole;
    const local = resolve(decode(url.replace(/&amp;/g, '&')).replace(/^\.\//, ''));
    return local ? `${pre}${escapeAttr(local)}${post}` : whole;
  });
}

// The writeup body as the site renders it, plus the build's verdict on it.
export function renderBody(markdown: string, slug: string): { html: string; issue: string | null } {
  const { data, content } = parseFrontmatter(markdown);
  const body = stripArticleChrome(stripRepeatedDescription(content, data.description));
  const options = { ...processorOptions, fileURL: new URL(`file:///writeups/${encodeURIComponent(slug)}/index.mdx`) };
  let issue: string | null = null;
  try {
    mdxToJs(body, options);
  } catch (err) {
    issue = firstLine(err);
  }
  try {
    return { html: markdownToHtml(body, options).html, issue };
  } catch (err) {
    return { html: '', issue: issue ?? firstLine(err) };
  }
}

export function buildPreviewDoc(input: RenderInput): string {
  const { markdown, slug, title, date, coverImage, coverAlt, technologies, resolveAsset } = input;

  let body: string;
  try {
    const { html, issue } = renderBody(markdown, slug);
    const banner = issue
      ? `<p class="svo-issue">The site build would reject this writeup: ${escapeHtml(issue)}</p>`
      : '';
    body = banner + rewriteAssets(html, resolveAsset);
  } catch (err) {
    body = `<pre class="svo-error">Preview failed to render:\n${escapeHtml(String(err))}</pre>`;
  }

  // Article header / hero / tags: the same structure as portfolio/[slug]/index.astro.
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
    // @font-face (base.css's font URL is absolute and can't resolve in the
    // iframe, so previewStyles gets the inlined woff2).
    previewStyles({ baseCss: siteBaseCss, fontUrl: interFontUrl }),
    '<style>',
    '  html { color-scheme: light; }',
    '  body { margin: 0; background: var(--color-bg, #fff); }',
    '  main.article { padding: 2rem var(--gutter, 1.5rem) 3rem; }',
    '  .svo-error { white-space: pre-wrap; color: #991b1b; font-family: var(--font-mono, monospace); padding: 1rem; }',
    '  .svo-issue { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: .75rem 1rem; font-size: .9rem; }',
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
