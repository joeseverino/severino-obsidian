// Site modules and assets imported by esbuild aliases + loaders (see
// scripts/site-paths.mjs). We consume the real owners' files; we don't fork
// them. These ambient declarations type-check whether or not the jseverino.com
// checkout is present, so CI (which checks out only this repo) type-checks the
// same as local.

// Sätteri, from the site's install (the same copy its plugins are defined with).
declare module '@site/satteri' {
  export interface CompileOptions {
    features?: Record<string, unknown>;
    mdastPlugins?: readonly unknown[];
    hastPlugins?: readonly unknown[];
    fileURL?: URL;
  }
  export function markdownToHtml(source: string, options?: CompileOptions): { html: string };
  export function mdxToJs(source: string, options?: CompileOptions): unknown;
}

// The site's content renderer configuration (src/lib/markdown/index.ts).
declare module '@site/markdown' {
  import type { CompileOptions } from '@site/satteri';
  export const processorOptions: Required<Pick<CompileOptions, 'features' | 'mdastPlugins' | 'hastPlugins'>>;
}

// The writeup body transforms the sync applies (src/lib/writeup-body.ts).
declare module '@site/writeup-body' {
  export function stripArticleChrome(markdown: string): string;
  export function stripRepeatedDescription(markdown: string, description: unknown): string;
}

// base.css with its @imports bundled, as text, injected into the preview iframe.
declare module '@site/base-css' {
  const css: string;
  export default css;
}

// The site's Inter woff2, inlined as a data URI (dataurl loader).
declare module '@site/inter-font' {
  const dataUri: string;
  export default dataUri;
}

// The brand JS monogram mark (public/assets/brand/mark.svg), bundled as text so
// the cockpit header shows the real logo without forking the asset.
declare module '@site/brand-mark' {
  const svg: string;
  export default svg;
}

// The site's "load BOTH" bundle: base.css + brand vars + Inter @font-face as one
// <style> blob, so the preview can't forget the brand vars (src/lib/web-styles.ts).
declare module '@site/web-styles' {
  export function previewStyles(opts: { baseCss: string; fontUrl: string }): string;
}

// The site's YAML frontmatter helper (src/lib/frontmatter.ts).
declare module '@site/frontmatter' {
  export function parseFrontmatter(markdown: string): {
    content: string;
    data: Record<string, unknown>;
  };
}
