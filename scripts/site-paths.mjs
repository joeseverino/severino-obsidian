// Shared resolution of the site/vault checkout, the `@site/*` alias map, and
// the esbuild plugins that load the site's renderer. Both the plugin bundle
// (esbuild.config.mjs) and the preview-render harness (scripts/preview-render.mjs)
// consume this, so "where the renderer + CSS come from" is authored once.
//
// Overridable, mirroring brand/sync.mjs:
//   SITE_DIR   the jseverino.com checkout      (default ~/Code/Projects/jseverino.com)
//   VAULT_DIR  the Obsidian vault              (default ~/Documents/Code/Severino Labs)
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import process from 'node:process';
import { createRequire } from 'node:module';
import esbuild from 'esbuild';

export const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const siteDir = process.env.SITE_DIR
  ? path.resolve(process.env.SITE_DIR)
  : path.resolve(os.homedir(), 'Code/Projects/jseverino.com');

export const vaultDir = process.env.VAULT_DIR
  ? path.resolve(process.env.VAULT_DIR)
  : path.resolve(os.homedir(), 'Documents/Code/Severino Labs');

const satteriDir = path.join(siteDir, 'node_modules/satteri');

// The owners the plugin imports instead of reimplementing.
export const sitePaths = {
  '@site/markdown': path.join(siteDir, 'src/lib/markdown/index.ts'),
  '@site/satteri': path.join(satteriDir, 'dist/index.js'),
  '@site/writeup-body': path.join(siteDir, 'src/lib/writeup-body.ts'),
  '@site/base-css': path.join(siteDir, 'src/styles/base.css'),
  '@site/web-styles': path.join(siteDir, 'src/lib/web-styles.ts'),
  '@site/frontmatter': path.join(siteDir, 'src/lib/frontmatter.ts'),
  '@site/inter-font': path.join(siteDir, 'public/assets/fonts/inter/inter-variable-latin.woff2'),
  '@site/brand-mark': path.join(siteDir, 'public/assets/brand/mark.svg'),
};

// esbuild loaders for the non-JS owners (SVG as text, the woff2 as a data URL).
// base.css goes through siteCssPlugin, which bundles its @imports.
export const siteLoader = { '.svg': 'text', '.woff2': 'dataurl' };

// Sätteri's native addon for this machine, from the site's install.
const nativePkg = `@bruits/satteri-${process.platform}-${process.arch}`;
export const satteriNative = (() => {
  try {
    return createRequire(path.join(satteriDir, 'package.json')).resolve(nativePkg);
  } catch {
    return path.join(siteDir, 'node_modules', nativePkg, `satteri_napi.${process.platform}-${process.arch}.node`);
  }
})();

const labels = {
  '@site/markdown': 'site renderer',
  '@site/satteri': 'satteri (npm ci in the site)',
  '@site/writeup-body': 'site writeup body transforms',
  '@site/base-css': 'site base.css',
  '@site/web-styles': 'site web-styles.ts',
  '@site/frontmatter': 'site frontmatter helper',
  '@site/inter-font': 'Inter font',
  '@site/brand-mark': 'brand mark',
  satteriNative: `Sätteri native addon (${nativePkg})`,
};

// Fail loudly (and identically) if the site checkout isn't where we expect.
export function assertSitePaths() {
  for (const [key, p] of Object.entries({ ...sitePaths, satteriNative })) {
    if (!fs.existsSync(p)) {
      console.error(`Missing ${labels[key]} at ${p}. Set SITE_DIR to your jseverino.com checkout.`);
      process.exit(1);
    }
  }
}

// Sätteri reaches its binding through the `#binding` package import. The
// browser condition is the threaded WASI build (SharedArrayBuffer, a Worker,
// async init); the node condition finds the addon relative to import.meta.url,
// which a bundle loses. Both are replaced by a lazy require of the native
// addon at a path set at runtime (src/satteri-binding.ts), over Sätteri's own
// export list so a version bump can't drift it.
function satteriBindingPlugin() {
  return {
    name: 'satteri-binding',
    setup(build) {
      build.onResolve({ filter: /^#binding$/ }, (args) =>
        args.importer.startsWith(satteriDir) ? { path: 'binding', namespace: 'satteri-binding' } : undefined,
      );
      build.onLoad({ filter: /.*/, namespace: 'satteri-binding' }, () => {
        const source = fs.readFileSync(path.join(satteriDir, 'dist/binding.js'), 'utf8');
        const names = (/export\s*\{([^}]*)\}/.exec(source)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!names.length) throw new Error(`no exports in ${satteriDir}/dist/binding.js`);
        const contents = [
          `import { loadSatteriBinding as load } from ${JSON.stringify(path.join(repoRoot, 'src/satteri-binding.ts'))};`,
          ...names.map((n) => `export const ${n} = (...a) => load().${n}(...a);`),
        ].join('\n');
        return { contents, loader: 'js', resolveDir: repoRoot };
      });
    },
  };
}

// base.css is an @import entry; bundle it to one stylesheet, as text. The
// absolute /assets font URL stays (previewStyles supplies a resolvable one).
function siteCssPlugin() {
  return {
    name: 'site-css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const result = await esbuild.build({
          entryPoints: [args.path],
          bundle: true,
          write: false,
          minify: true,
          metafile: true,
          external: ['/assets/*'],
          logLevel: 'silent',
        });
        return {
          contents: result.outputFiles[0].text,
          loader: 'text',
          watchFiles: Object.keys(result.metafile.inputs).map((p) => path.resolve(p)),
        };
      });
    },
  };
}

export const sitePlugins = () => [satteriBindingPlugin(), siteCssPlugin()];
