// Site assets imported by esbuild aliases + loaders (see esbuild.config.mjs).
// We consume the real owners' files; we don't fork them. These ambient
// declarations type-check whether or not the sibling jseverino.com checkout is
// present, so CI (which checks out only this repo) type-checks the same as local.

// The site's markdown → HTML writeup renderer (src/lib/markdown.ts).
declare module '@site/markdown' {
  export function renderWriteupHtml(markdown: string, slug: string): string;
}

// base.css as a text string (text loader), injected into the preview iframe.
declare module '@site/base-css' {
  const css: string;
  export default css;
}

// The site's Inter woff2, inlined as a data URI (dataurl loader).
declare module '@site/inter-font' {
  const dataUri: string;
  export default dataUri;
}

// The token-synced brand identity (src/lib/brand.mjs).
declare module '@site/brand' {
  export const BRAND: { navy: string; navyDeep: string; [key: string]: unknown };
}

// The site's "load BOTH" bundle: base.css + brand vars + Inter @font-face as one
// <style> blob, so the preview can't forget the brand vars (src/lib/web-styles.mjs).
declare module '@site/web-styles' {
  export function previewStyles(opts: { baseCss: string; fontUrl: string }): string;
}

// The site's YAML parser helper. Astro strips frontmatter before rendering;
// the plugin passes raw vault files through this same helper instead of
// maintaining a regex splitter.
declare module '@site/frontmatter' {
  export function parseFrontmatter(markdown: string): {
    content: string;
    data: Record<string, unknown>;
  };
}
