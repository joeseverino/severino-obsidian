import { TFile, TFolder } from 'obsidian';

export function makeFile(path: string): TFile {
  const file = new TFile();
  const name = path.split('/').pop() ?? path;
  file.path = path;
  file.name = name;
  file.extension = name.includes('.') ? (name.split('.').pop() ?? '') : '';
  file.basename = name.replace(/\.[^.]+$/, '');
  return file;
}

export function makeFolder(path: string, children: TFile[] = []): TFolder {
  const folder = new TFolder();
  folder.path = path;
  folder.name = path.split('/').pop() ?? path;
  folder.children = children;
  for (const child of children) child.parent = folder;
  return folder;
}

export function attach(file: TFile, parent: TFolder): TFile {
  file.parent = parent;
  return file;
}
