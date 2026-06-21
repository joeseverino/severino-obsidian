import { Editor } from 'obsidian';

// Skeletons for the site's block DSL (jseverino.com/src/lib/markdown.ts). The
// site owns what these blocks MEAN; this just types the boilerplate. A current
// selection is dropped into the body, so each command wraps as well as inserts.
type Skeleton = (selection: string) => string;

const figure: Skeleton = (sel) =>
  ['::figure', `![${sel || 'Alt text'}](./images/NAME.png)`, 'Caption goes here.', '::', ''].join('\n');

const table: Skeleton = (sel) =>
  [
    '::table',
    '| Column | Column |',
    '|--------|--------|',
    '| Cell   | Cell   |',
    sel || 'Caption goes here.',
    '::',
    '',
  ].join('\n');

const terminal: Skeleton = (sel) =>
  ['::terminal', sel || '$ command here', 'output line', '::', ''].join('\n');

export const SKELETONS = { figure, table, terminal } as const;
export type BlockKind = keyof typeof SKELETONS;

export function insertBlock(editor: Editor, kind: BlockKind): void {
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
