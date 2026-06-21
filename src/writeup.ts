import { App, TFile, MarkdownView } from 'obsidian';

// Writeups live at `05 Writeups/<slug>/index.md`; the slug is the folder name.
export const WRITEUPS_DIR = '05 Writeups';

export interface ActiveWriteup {
  file: TFile;
  slug: string;
  markdown: string;
  frontmatter: Record<string, unknown>;
}

export function isWriteupFile(file: TFile | null): file is TFile {
  return !!file && file.extension === 'md' && file.path.startsWith(`${WRITEUPS_DIR}/`);
}

export function writeupSlug(file: TFile): string {
  return file.parent?.name ?? file.basename;
}

// Prefer the live editor buffer (unsaved edits) so the preview tracks what you
// type; fall back to the file on disk otherwise.
export async function readActiveMarkdown(app: App, file: TFile): Promise<string> {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view?.file?.path === file.path) return view.editor.getValue();
  return app.vault.cachedRead(file);
}

export async function getActiveWriteup(app: App): Promise<ActiveWriteup | null> {
  const file = app.workspace.getActiveFile();
  if (!isWriteupFile(file)) return null;
  const markdown = await readActiveMarkdown(app, file);
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  return { file, slug: writeupSlug(file), markdown, frontmatter };
}

// Map a site asset path (e.g. images/foo.png, relative to the writeup folder) to
// an Obsidian resource URL for the local file, or null if it doesn't exist.
export function localAssetResolver(app: App, file: TFile): (rel: string) => string | null {
  const folder = file.parent?.path ?? '';
  return (rel: string) => {
    const clean = rel.replace(/^\.?\//, '');
    const target = app.vault.getAbstractFileByPath(`${folder}/${clean}`);
    return target instanceof TFile ? app.vault.getResourcePath(target) : null;
  };
}
