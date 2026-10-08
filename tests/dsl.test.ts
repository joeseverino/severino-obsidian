import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insertBlock, isBlockKind, SKELETONS, type BlockEditor } from '../src/dsl.ts';

interface Recorded {
  replacedSelection: string[];
  replacedRange: { text: string; from: { line: number; ch: number } }[];
}

function fakeEditor(selection: string, ch: number): { editor: BlockEditor; calls: Recorded } {
  const calls: Recorded = { replacedSelection: [], replacedRange: [] };
  const editor: BlockEditor = {
    getSelection: () => selection,
    replaceSelection: (text) => {
      calls.replacedSelection.push(text);
    },
    getCursor: () => ({ line: 3, ch }),
    replaceRange: (text, from) => {
      calls.replacedRange.push({ text, from });
    },
  };
  return { editor, calls };
}

test('figure skeleton uses the selection as alt text', () => {
  assert.equal(
    SKELETONS.figure('Rack'),
    [':::figure', '![Rack](./images/NAME.png)', 'Caption goes here.', ':::', ''].join('\n'),
  );
  assert.match(SKELETONS.figure(''), /!\[Alt text\]/);
});

test('table skeleton keeps a blank line before the caption', () => {
  const lines = SKELETONS.table('Ports').split('\n');
  assert.equal(lines[0], ':::table');
  assert.equal(lines[4], '');
  assert.equal(lines[5], 'Ports');
});

test('terminal skeleton fences the selection', () => {
  assert.equal(SKELETONS.terminal('$ ls'), ['```terminal', '$ ls', 'output line', '```', ''].join('\n'));
});

test('a selection is wrapped in place', () => {
  const { editor, calls } = fakeEditor('Rack', 4);
  insertBlock(editor, 'figure');
  assert.equal(calls.replacedSelection.length, 1);
  assert.equal(calls.replacedRange.length, 0);
});

test('insertion mid-line starts the block on its own line', () => {
  const { editor, calls } = fakeEditor('', 7);
  insertBlock(editor, 'terminal');
  assert.equal(calls.replacedRange[0]?.text.startsWith('\n```terminal'), true);
});

test('insertion at column zero adds no leading newline', () => {
  const { editor, calls } = fakeEditor('', 0);
  insertBlock(editor, 'table');
  assert.equal(calls.replacedRange[0]?.text.startsWith(':::table'), true);
  assert.deepEqual(calls.replacedRange[0]?.from, { line: 3, ch: 0 });
});

test('isBlockKind accepts only the three block names', () => {
  assert.equal(isBlockKind('figure'), true);
  assert.equal(isBlockKind('table'), true);
  assert.equal(isBlockKind('terminal'), true);
  assert.equal(isBlockKind('toString'), false);
  assert.equal(isBlockKind('quote'), false);
});
