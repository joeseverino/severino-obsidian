import { App, TFile, TFolder } from 'obsidian';

// Asset Doctor enforces the vault's "images/ is orphan-free" rule for a writeup:
// every file in images/ should be referenced, and every reference should resolve.
// Pure filesystem + text scan — nobody else owns this, so the plugin can.

const IMG_DIR = 'images';

export interface AssetReport {
  present: string[]; // files in images/, as images/<name>
  referenced: string[]; // image paths the markdown references
  orphans: string[]; // present but not referenced
  missing: string[]; // referenced but not present
}

// Every local image reference: ![alt](images/x), the alt-pipe form
// ![alt|320](./images/x), and raw <img src="images/x">. The site's block
// directives and captions don't change the src, so a path scan is sufficient.
function referencedImages(markdown: string): string[] {
  const refs = new Set<string>();
  const add = (raw: string): void => {
    const clean = raw.trim().replace(/^\.?\//, '');
    if (clean.startsWith(`${IMG_DIR}/`)) refs.add(clean);
  };
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) add(m[1]);
  for (const m of markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)) add(m[1]);
  // cover_image lives in frontmatter, not the body, but it's a real reference —
  // count it so the cover isn't reported as an orphan.
  for (const m of markdown.matchAll(/^\s*cover_image:\s*["']?([^"'\n]+?)["']?\s*$/gm)) add(m[1]);
  return [...refs];
}

export function assetReport(app: App, file: TFile, markdown: string): AssetReport {
  const folder = file.parent?.path ?? '';
  const dir = app.vault.getAbstractFileByPath(`${folder}/${IMG_DIR}`);
  const present =
    dir instanceof TFolder
      ? dir.children
          .filter((c): c is TFile => c instanceof TFile)
          .map((f) => `${IMG_DIR}/${f.name}`)
      : [];

  const referenced = referencedImages(markdown);
  const presentSet = new Set(present);
  const refSet = new Set(referenced);

  return {
    present,
    referenced,
    orphans: present.filter((p) => !refSet.has(p)).sort(),
    missing: referenced.filter((r) => !presentSet.has(r)).sort(),
  };
}
