#!/usr/bin/env node
// Headless preview harness: lets a session outside Obsidian (a human, CI, or an
// AI) see what the Site preview pane renders. It bundles src/render.ts with the
// plugin's own resolution (aliases, Sätteri binding shim, CSS bundling),
// assembles the same preview document from a real vault writeup, and
// screenshots it to a PNG.
//
//   npm run preview:render <slug>                 # → /tmp/preview-<slug>.png
//   npm run preview:render <slug> -- --out x.png  # custom output
//   npm run preview:render <slug> -- --html       # also dump the assembled HTML
//   npm run preview:render <slug> -- --width 420  # viewport width (default 900)
//
// Renderer + CSS come from the same owners the plugin bundles (scripts/site-paths.mjs).
// Chromium is borrowed from the site's installed Playwright; no new dependency here.
import esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { repoRoot, siteDir, vaultDir, sitePaths, siteLoader, sitePlugins, satteriNative, assertSitePaths } from './site-paths.mjs';

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--out', '--width'];
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const slug = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
const outArg = flag('--out');
const width = Number(flag('--width') ?? 900);
const dumpHtml = args.includes('--html');

if (!slug) {
  console.error('usage: npm run preview:render <slug> [-- --out file.png] [--html] [--width px]');
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
// resolving the @site/* owners exactly as the plugin build does (browser
// platform included, so a Node-only import in the site's renderer fails here too).
const tmpOut = path.join(os.tmpdir(), `svo-preview-${process.pid}.mjs`);
await esbuild.build({
  stdin: {
    contents: [
      "export { buildPreviewDoc } from './src/render.ts';",
      "export { setSatteriBinding } from './src/satteri-binding.ts';",
      "export { parseFrontmatter } from '@site/frontmatter';",
    ].join('\n'),
    resolveDir: repoRoot,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2021',
  alias: sitePaths,
  loader: siteLoader,
  plugins: sitePlugins(),
  logLevel: 'warning',
  // The plugin requires Sätteri's addon through Obsidian's require; give the
  // ESM bundle Node's.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  outfile: tmpOut,
});

const { buildPreviewDoc, setSatteriBinding, parseFrontmatter } = await import(pathToFileURL(tmpOut).href);
setSatteriBinding(satteriNative);

const raw = fs.readFileSync(indexMd, 'utf8');
const { data } = parseFrontmatter(raw);

// YAML parses `published_at: 2026-04-26` to a Date; the renderer wants a string.
const asDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

// Inline document-relative images as data URIs (a setContent page can't load
// file:// URLs); other local files resolve to file:// links.
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
const resolveAsset = (rel) => {
  const p = path.join(writeupDir, rel.replace(/^\.?\//, ''));
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  const mime = MIME[path.extname(p).toLowerCase()];
  return mime ? `data:${mime};base64,${fs.readFileSync(p).toString('base64')}` : pathToFileURL(p).href;
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
const page = await browser.newPage({ viewport: { width, height: 1200 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
fs.rmSync(tmpOut, { force: true });

console.log(`✓ image → ${out}`);
