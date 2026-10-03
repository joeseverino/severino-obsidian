// Sätteri's native addon. The bundle routes Sätteri's `#binding` import here
// (scripts/site-paths.mjs); the addon is required on first render from the
// path the host sets: the plugin folder in Obsidian, the site's install in the
// preview harness.

// The addon's file name beside main.js; esbuild.config.mjs copies it there.
export const SATTERI_ADDON = 'satteri.node';

type Binding = Record<string, (...args: unknown[]) => unknown>;

let addonPath: string | null = null;
let binding: Binding | null = null;

export function setSatteriBinding(path: string): void {
  addonPath = path;
}

export function loadSatteriBinding(): Binding {
  if (binding) return binding;
  if (!addonPath) throw new Error('Sätteri addon path not set');
  binding = require(addonPath) as Binding;
  return binding;
}
