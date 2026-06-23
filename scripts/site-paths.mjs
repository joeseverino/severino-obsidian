// Shared resolution of the site/vault checkout and the `@site/*` alias map.
// Both the plugin bundle (esbuild.config.mjs) and the preview-render harness
// (scripts/preview-render.mjs) consume this, so "where the renderer + CSS come
// from" is authored once, not twice.
//
// Overridable, mirroring brand/sync.mjs:
//   SITE_DIR   the jseverino.com checkout      (default ~/Documents/Code/Projects/jseverino.com)
//   VAULT_DIR  the Obsidian vault              (default ~/Documents/Code/Severino Labs)
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import process from 'node:process';

export const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const siteDir = process.env.SITE_DIR
  ? path.resolve(process.env.SITE_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Projects/jseverino.com');

export const vaultDir = process.env.VAULT_DIR
  ? path.resolve(process.env.VAULT_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Severino Labs');

// The owners the plugin imports instead of reimplementing.
export const sitePaths = {
  '@site/markdown': path.join(siteDir, 'src/lib/markdown.ts'),
  '@site/base-css': path.join(siteDir, 'src/styles/base.css'),
  '@site/brand': path.join(siteDir, 'src/lib/brand.mjs'),
  '@site/web-styles': path.join(siteDir, 'src/lib/web-styles.mjs'),
  '@site/frontmatter': path.join(siteDir, 'src/lib/frontmatter.mjs'),
  '@site/inter-font': path.join(siteDir, 'public/assets/fonts/inter/inter-variable-latin.woff2'),
  '@site/brand-mark': path.join(siteDir, 'public/assets/brand/mark.svg'),
};

// esbuild loaders for the non-JS owners (CSS/SVG as text, the woff2 as a data URL).
export const siteLoader = { '.css': 'text', '.svg': 'text', '.woff2': 'dataurl' };

const labels = {
  '@site/markdown': 'site renderer',
  '@site/base-css': 'site base.css',
  '@site/brand': 'site brand.mjs',
  '@site/frontmatter': 'site frontmatter helper',
  '@site/inter-font': 'Inter font',
};

// Fail loudly (and identically) if the site checkout isn't where we expect.
export function assertSitePaths() {
  for (const [alias, p] of Object.entries(sitePaths)) {
    if (!fs.existsSync(p)) {
      console.error(`Missing ${labels[alias]} at ${p}. Set SITE_DIR to your jseverino.com checkout.`);
      process.exit(1);
    }
  }
}
