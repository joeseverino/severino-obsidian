// Site assets imported by esbuild aliases + loaders (see esbuild.config.mjs).
// We consume the real owners' files; we don't fork them.

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
