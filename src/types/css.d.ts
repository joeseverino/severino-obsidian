// Site assets imported by esbuild aliases + loaders (see esbuild.config.ts).
// We consume the real owners' files; we don't fork them. These ambient
// declarations type-check whether or not the sibling jseverino.com checkout is
// present, so CI (which checks out only this repo) type-checks the same as local.

// The brand JS monogram mark (public/assets/brand/mark.svg), bundled as text so
// the cockpit header shows the real logo without forking the asset.
declare module '@site/brand-mark' {
  const svg: string;
  export default svg;
}
