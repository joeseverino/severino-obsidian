#!/usr/bin/env node
// Headless preview harness — the thing that lets a non-Obsidian session (a human
// in CI, or an AI) actually SEE what the Site preview pane renders, instead of
// claiming it "matches" blind. It assembles the exact same preview document the
// plugin builds (buildPreviewDoc → base.css + brand vars + inlined font) and
// screenshots it to a PNG.
//
//   npm run preview:render <slug>                 # → /tmp/preview-<slug>.png
//   npm run preview:render <slug> -- --out x.png  # custom output
//   npm run preview:render <slug> -- --html       # also dump the assembled HTML
//
// Renderer + CSS come from the same owners the plugin bundles (scripts/site-paths.mjs).
// Chromium is borrowed from the site's installed Playwright — no new dependency here.
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type * as Render from '../src/render.ts';
import { isSiteRender } from '../src/render.ts';
import { isRecord } from '../src/guards.ts';
import { repoRoot, siteDir, vaultDir, sitePaths, siteLoader, assertSitePaths } from './site-paths.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    html: { type: 'boolean', default: false },
  },
});
const slug = positionals[0];
const outArg = values.out;
const dumpHtml = values.html;

interface Chromium {
  launch(): Promise<{
    newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<{
      setContent(html: string, options: { waitUntil: 'networkidle' }): Promise<void>;
      screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
    }>;
    close(): Promise<void>;
  }>;
}
const isChromium = (value: unknown): value is Chromium => isRecord(value) && typeof value.launch === 'function';

if (!slug) {
  console.error('usage: npm run preview:render <slug> [-- --out file.png] [--html]');
  process.exit(1);
}

assertSitePaths();

const writeupDir = path.join(vaultDir, '05 Writeups', slug);
const indexMd = path.join(writeupDir, 'index.md');
if (!fs.existsSync(indexMd)) {
  console.error(`✗ No writeup at ${indexMd}`);
  process.exit(1);
}

// Bundle buildPreviewDoc to a temp ESM module, resolving the @site/* owners
// exactly as the plugin build does.
const tmpOut = path.join(os.tmpdir(), `svo-preview-${process.pid}.mjs`);
await esbuild.build({
  stdin: {
    contents: "export { buildPreviewDoc } from './src/render.ts';\n",
    resolveDir: repoRoot,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  alias: sitePaths,
  loader: siteLoader,
  logLevel: 'warning',
  outfile: tmpOut,
});

const { buildPreviewDoc }: typeof Render = await import(pathToFileURL(tmpOut).href);

const raw = fs.readFileSync(indexMd, 'utf8');

// Point site asset URLs back at the local writeup folder (file:// so Chromium loads them).
const resolveAsset = (rel: string): string | null => {
  const p = path.join(writeupDir, rel.replace(/^\.?\//, ''));
  return fs.existsSync(p) ? pathToFileURL(p).href : null;
};

// The page comes from the site checkout's own `site render --document`, as in the plugin.
const renderDocument = async (markdown: string): Promise<string> => {
  const run = spawnSync(process.execPath, [path.join(siteDir, 'bin/site.ts'), 'render', '-', '--document', '--json'], {
    input: markdown,
    encoding: 'utf8',
    env: { ...process.env, VAULT_DIR: vaultDir },
    maxBuffer: 16 * 1024 * 1024,
  });
  const doc: unknown = JSON.parse(run.stdout || '{}');
  if (!isSiteRender(doc)) throw new Error(run.stderr || 'site render failed');
  if (!doc.ok || typeof doc.document !== 'string') throw new Error(doc.error?.message ?? (run.stderr || 'site render failed'));
  return doc.document;
};

const html = await buildPreviewDoc({ markdown: raw, slug, resolveAsset, renderDocument });

const out = path.resolve(outArg ?? path.join(os.tmpdir(), `preview-${slug}.png`));

if (dumpHtml) {
  const htmlOut = out.replace(/\.png$/, '') + '.html';
  fs.writeFileSync(htmlOut, html);
  console.log(`✓ html  → ${htmlOut}`);
}

// Borrow Chromium from the site's Playwright install.
let chromium: Chromium;
try {
  const playwright: unknown = createRequire(path.join(siteDir, 'package.json'))('playwright');
  if (!isRecord(playwright) || !isChromium(playwright.chromium)) throw new Error('playwright has no chromium');
  chromium = playwright.chromium;
} catch {
  console.error(`✗ Could not load Playwright from ${siteDir}. Run \`npm i\` there (or \`npx playwright install chromium\`).`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
fs.rmSync(tmpOut, { force: true });

console.log(`✓ image → ${out}`);
