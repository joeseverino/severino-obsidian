// Bundle the plugin into the vault's plugin dir. The two things that make this
// plugin "own almost nothing" are the aliases below: the markdown→HTML renderer
// and the writeup CSS are imported straight from their real owners (the site and
// the brand-token-synced base.css), never reimplemented here. The site/vault
// resolution + alias map live in scripts/site-paths.mjs (shared with the
// preview-render harness), so they're authored once.
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { repoRoot, vaultDir, sitePaths, siteLoader, assertSitePaths } from './scripts/site-paths.mjs';

const watch = process.argv.includes('--watch');

assertSitePaths();

const outDir = path.join(vaultDir, '.obsidian/plugins/severino-obsidian');
fs.mkdirSync(outDir, { recursive: true });

// Static assets that ship beside main.js.
function copyStatics() {
  for (const name of ['manifest.json', 'styles.css', 'versions.json']) {
    fs.copyFileSync(path.join(repoRoot, name), path.join(outDir, name));
  }
}

const banner = `/* severino-obsidian — generated bundle. Source: Projects/severino-obsidian. Do not edit here. */`;

const options = {
  entryPoints: [path.join(repoRoot, 'src/main.ts')],
  bundle: true,
  format: 'cjs',
  target: 'es2021',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  treeShaking: true,
  banner: { js: banner },
  // The whole point: pull rendering + styles from their owners.
  alias: sitePaths,
  loader: siteLoader,
  external: [
    'obsidian',
    'electron',
    // Node builtins — available in Obsidian's Electron runtime (isDesktopOnly);
    // used to invoke the site/MCP CLIs so the plugin consumes their code path.
    'child_process',
    'util',
    'fs',
    'path',
    'os',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
  ],
  outfile: path.join(outDir, 'main.js'),
};

if (watch) {
  const ctx = await esbuild.context(options);
  copyStatics();
  await ctx.watch();
  console.log(`watching → ${outDir}`);
} else {
  await esbuild.build(options);
  copyStatics();
  console.log(`built → ${outDir}`);
}
