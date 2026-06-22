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
import { pathToFileURL } from 'node:url';
import { repoRoot, siteDir, vaultDir, sitePaths, siteLoader, assertSitePaths } from './site-paths.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const dumpHtml = args.includes('--html');

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

// Bundle buildPreviewDoc (+ the site frontmatter parser) to a temp ESM module,
// resolving the @site/* owners exactly as the plugin build does.
const tmpOut = path.join(os.tmpdir(), `svo-preview-${process.pid}.mjs`);
await esbuild.build({
  stdin: {
    contents: "export { buildPreviewDoc } from './src/render.ts';\nexport { parseFrontmatter } from '@site/frontmatter';\n",
    resolveDir: repoRoot,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2021',
  alias: sitePaths,
  loader: siteLoader,
  logLevel: 'warning',
  // The site libs pull in CJS deps (gray-matter) that `require('fs')`; give the
  // ESM bundle a real require so node builtins resolve at runtime.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  outfile: tmpOut,
});

const { buildPreviewDoc, parseFrontmatter } = await import(pathToFileURL(tmpOut).href);

const raw = fs.readFileSync(indexMd, 'utf8');
const { data } = parseFrontmatter(raw);

// YAML parses `published_at: 2026-04-26` to a Date; the renderer wants a string.
const asDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

// Point site asset URLs back at the local writeup folder (file:// so Chromium loads them).
const resolveAsset = (rel) => {
  const p = path.join(writeupDir, rel.replace(/^\.?\//, ''));
  return fs.existsSync(p) ? pathToFileURL(p).href : null;
};

const html = buildPreviewDoc({
  markdown: raw,
  slug,
  title: data.title ?? slug,
  date: asDateStr(data.published_at ?? data.date),
  coverImage: data.cover_image,
  coverAlt: data.cover_alt,
  technologies: data.technologies ?? [],
  resolveAsset,
});

const out = path.resolve(outArg ?? path.join(os.tmpdir(), `preview-${slug}.png`));

if (dumpHtml) {
  const htmlOut = out.replace(/\.png$/, '') + '.html';
  fs.writeFileSync(htmlOut, html);
  console.log(`✓ html  → ${htmlOut}`);
}

// Borrow Chromium from the site's Playwright install.
let chromium;
try {
  chromium = createRequire(path.join(siteDir, 'package.json'))('playwright').chromium;
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
