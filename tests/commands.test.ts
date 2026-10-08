import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EFFECTS, OBSIDIAN_COMMANDS } from '../src/commands.ts';
import { isBlockKind } from '../src/dsl.ts';
import { webUrl } from '../src/launch.ts';

test('command ids are unique and every spec is complete', () => {
  const ids = OBSIDIAN_COMMANDS.map((command) => command.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const command of OBSIDIAN_COMMANDS) {
    assert.ok(command.name && command.summary && command.group, command.id);
    assert.ok(EFFECTS.includes(command.effect), command.id);
  }
});

test('every editor command maps to a block skeleton', () => {
  const editorCommands = OBSIDIAN_COMMANDS.filter((command) => command.type === 'editor');
  assert.ok(editorCommands.length > 0);
  for (const command of editorCommands) {
    assert.equal(isBlockKind(command.id.replace(/^insert-/, '')), true, command.id);
  }
});

test('git remotes become https web URLs', () => {
  assert.equal(webUrl('git@github.com:joeseverino/demo.git\n'), 'https://github.com/joeseverino/demo');
  assert.equal(webUrl('https://github.com/joeseverino/demo.git'), 'https://github.com/joeseverino/demo');
  assert.equal(webUrl('/local/path'), null);
});
