// Shared resolution of the site/vault checkout and the `@site/*` alias map
// (the brand mark; the preview comes from `site render`).
// Both the plugin bundle (esbuild.config.mjs) and the preview-render harness
// (scripts/preview-render.mjs) consume this, so "where the renderer + CSS come
// from" is authored once, not twice.
//
// Overridable, mirroring brand/sync.mjs:
//   SITE_DIR   the jseverino.com checkout      (default ~/Code/Projects/jseverino.com)
//   VAULT_DIR  the Obsidian vault              (default ~/Documents/Code/Severino Labs)
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import process from 'node:process';
import type { Loader } from 'esbuild';

export const repoRoot = path.resolve(import.meta.dirname, '..');

export const siteDir = process.env.SITE_DIR
  ? path.resolve(process.env.SITE_DIR)
  : path.resolve(os.homedir(), 'Code/Projects/jseverino.com');

export const vaultDir = process.env.VAULT_DIR
  ? path.resolve(process.env.VAULT_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Severino Labs');

// The owners the plugin imports instead of reimplementing.
export const sitePaths: Readonly<Record<string, string>> = {
  '@site/brand-mark': path.join(siteDir, 'public/assets/brand/mark.svg'),
};

// esbuild loader for the non-JS owner (the SVG mark as text).
export const siteLoader: Record<string, Loader> = { '.svg': 'text' };

const labels: Readonly<Record<string, string>> = {
  '@site/brand-mark': 'brand mark',
};

// Fail loudly (and identically) if the site checkout isn't where we expect.
export function assertSitePaths(): void {
  for (const [alias, p] of Object.entries(sitePaths)) {
    if (!fs.existsSync(p)) {
      console.error(`Missing ${labels[alias] ?? alias} at ${p}. Set SITE_DIR to your jseverino.com checkout.`);
      process.exit(1);
    }
  }
}
