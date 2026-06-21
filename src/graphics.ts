import { App, TFile, TFolder } from 'obsidian';
import { copyFileSync } from 'fs';
import { runTool } from './exec';

// Graphics status + render. The writeup asset-folder model: graphics/ holds the
// SOURCE (*.figure.json / *.mmd), images/ holds the RENDER that ships. This
// consumes the `brand figure` and `diagram` tools to render — it never draws
// anything itself.

const GRAPHICS = 'graphics';
const IMAGES = 'images';

export interface GraphicItem {
  source: string; // graphics/<name>.figure.json | .mmd
  rendered: string; // images/<name>.png
  isRendered: boolean;
}

export interface GraphicsStatus {
  items: GraphicItem[];
  unrendered: GraphicItem[];
}

function listFiles(app: App, folderPath: string): TFile[] {
  const folder = app.vault.getAbstractFileByPath(folderPath);
  return folder instanceof TFolder
    ? folder.children.filter((c): c is TFile => c instanceof TFile)
    : [];
}

const baseName = (fileName: string): string =>
  fileName.replace(/\.figure\.json$/, '').replace(/\.mmd$/, '');

const isSource = (name: string): boolean => name.endsWith('.figure.json') || name.endsWith('.mmd');

export function graphicsStatus(app: App, writeupFile: TFile): GraphicsStatus {
  const folder = writeupFile.parent?.path ?? '';
  const sources = listFiles(app, `${folder}/${GRAPHICS}`).filter((f) => isSource(f.name));
  const renders = new Set(listFiles(app, `${folder}/${IMAGES}`).map((f) => f.name));
  const items: GraphicItem[] = sources.map((f) => {
    const png = `${baseName(f.name)}.png`;
    return { source: `${GRAPHICS}/${f.name}`, rendered: `${IMAGES}/${png}`, isRendered: renders.has(png) };
  });
  return { items, unrendered: items.filter((i) => !i.isRendered) };
}

export interface RenderResult {
  rendered: string[];
  errors: string[];
}

// Render each source into images/ via the brand/diagram CLIs.
export async function renderGraphics(
  app: App,
  writeupFile: TFile,
  vaultRoot: string,
  onlyUnrendered = true,
): Promise<RenderResult> {
  const folder = writeupFile.parent?.path ?? '';
  const absFolder = `${vaultRoot}/${folder}`;
  const status = graphicsStatus(app, writeupFile);
  const targets = onlyUnrendered ? status.unrendered : status.items;
  const rendered: string[] = [];
  const errors: string[] = [];

  for (const item of targets) {
    const name = item.source.slice(`${GRAPHICS}/`.length);
    const base = baseName(name);
    const srcAbs = `${absFolder}/${GRAPHICS}/${name}`;
    const outAbs = `${absFolder}/${IMAGES}/${base}.png`;

    if (name.endsWith('.figure.json')) {
      const r = await runTool('brand', ['figure', srcAbs, '--out', outAbs], { cwd: absFolder });
      if (r.ok) rendered.push(item.rendered);
      else errors.push(`${item.source}: ${r.stderr.trim().slice(0, 200)}`);
    } else {
      // `diagram x.mmd` writes graphics/x.png next to it; copy into images/.
      const r = await runTool('diagram', [srcAbs], { cwd: absFolder });
      if (!r.ok) {
        errors.push(`${item.source}: ${r.stderr.trim().slice(0, 200)}`);
        continue;
      }
      try {
        copyFileSync(`${absFolder}/${GRAPHICS}/${base}.png`, outAbs);
        rendered.push(item.rendered);
      } catch (err) {
        errors.push(`${item.source}: copy failed — ${String(err)}`);
      }
    }
  }
  return { rendered, errors };
}
