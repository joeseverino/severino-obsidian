import type { Editor } from 'obsidian';

// Skeletons for the site's blocks (jseverino.com/src/lib/markdown/, standard
// directive syntax). The site owns what these blocks mean; this just types the
// boilerplate. A current selection is dropped into the body, so each command
// wraps as well as inserts.
type Skeleton = (selection: string) => string;

const figure: Skeleton = (sel) =>
  [':::figure', `![${sel || 'Alt text'}](./images/NAME.png)`, 'Caption goes here.', ':::', ''].join('\n');

const table: Skeleton = (sel) =>
  [
    ':::table',
    '| Column | Column |',
    '|--------|--------|',
    '| Cell   | Cell   |',
    // A fence right after a table would read as a table row.
    '',
    sel || 'Caption goes here.',
    ':::',
    '',
  ].join('\n');

const terminal: Skeleton = (sel) =>
  ['```terminal', sel || '$ command here', 'output line', '```', ''].join('\n');

export const SKELETONS = { figure, table, terminal } as const;
export type BlockKind = keyof typeof SKELETONS;

export const isBlockKind = (value: string): value is BlockKind => Object.hasOwn(SKELETONS, value);

export type BlockEditor = Pick<Editor, 'getSelection' | 'replaceSelection' | 'getCursor' | 'replaceRange'>;

export function insertBlock(editor: BlockEditor, kind: BlockKind): void {
  const sel = editor.getSelection();
  const text = SKELETONS[kind](sel);
  if (sel) {
    editor.replaceSelection(text);
    return;
  }
  const cursor = editor.getCursor();
  const prefix = cursor.ch === 0 ? '' : '\n'; // keep the block on its own line
  editor.replaceRange(prefix + text, cursor);
}
