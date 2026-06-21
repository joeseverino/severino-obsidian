// Bundle the plugin into the vault's plugin dir. The two things that make this
// plugin "own almost nothing" are the aliases below: the markdown→HTML renderer
// and the writeup CSS are imported straight from their real owners (the site and
// the brand-token-synced base.css), never reimplemented here.
//
// Overridable, mirroring brand/sync.mjs:
//   SITE_DIR   the jseverino.com checkout      (default ~/Documents/Code/Projects/jseverino.com)
//   VAULT_DIR  the Obsidian vault              (default ~/Documents/Code/Severino Labs)
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import process from 'node:process';

const watch = process.argv.includes('--watch');
const repoRoot = path.dirname(new URL(import.meta.url).pathname);

const siteDir = process.env.SITE_DIR
  ? path.resolve(process.env.SITE_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Projects/jseverino.com');
const vaultDir = process.env.VAULT_DIR
  ? path.resolve(process.env.VAULT_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Severino Labs');

const siteRenderer = path.join(siteDir, 'src/lib/markdown.ts');
const siteBaseCss = path.join(siteDir, 'src/styles/base.css');
const siteBrand = path.join(siteDir, 'src/lib/brand.mjs');
const interFont = path.join(siteDir, 'public/assets/fonts/inter/inter-variable-latin.woff2');
for (const [label, p] of [
  ['site renderer', siteRenderer],
  ['site base.css', siteBaseCss],
  ['site brand.mjs', siteBrand],
  ['Inter font', interFont],
]) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${label} at ${p}. Set SITE_DIR to your jseverino.com checkout.`);
    process.exit(1);
  }
}

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
  alias: {
    '@site/markdown': siteRenderer,
    '@site/base-css': siteBaseCss,
    '@site/brand': siteBrand,
    '@site/inter-font': interFont,
  },
  loader: { '.css': 'text', '.woff2': 'dataurl' },
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
