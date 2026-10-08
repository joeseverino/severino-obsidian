import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TAbstractFile } from 'obsidian';
import { isWriteupFile, localAssetResolver, writeupSlug } from '../src/writeup.ts';
import { attach, makeFile, makeFolder } from './helpers.ts';

test('only markdown files under 05 Writeups are writeups', () => {
  assert.equal(isWriteupFile(makeFile('05 Writeups/demo/index.md')), true);
  assert.equal(isWriteupFile(makeFile('05 Writeups/demo/images/a.png')), false);
  assert.equal(isWriteupFile(makeFile('01 Projects/demo/index.md')), false);
  assert.equal(isWriteupFile(null), false);
});

test('the slug is the parent folder name', () => {
  const folder = makeFolder('05 Writeups/demo');
  assert.equal(writeupSlug(attach(makeFile('05 Writeups/demo/index.md'), folder)), 'demo');
  assert.equal(writeupSlug(makeFile('loose.md')), 'loose');
});

test('asset paths resolve against the writeup folder', () => {
  const folder = makeFolder('05 Writeups/demo');
  const index = attach(makeFile('05 Writeups/demo/index.md'), folder);
  const image = makeFile('05 Writeups/demo/images/a.png');
  const app = {
    vault: {
      getAbstractFileByPath: (path: string): TAbstractFile | null => (path === image.path ? image : null),
      getResourcePath: (file: { path: string }): string => `app://local/${file.path}`,
    },
  };
  const resolve = localAssetResolver(app, index);
  assert.equal(resolve('images/a.png'), 'app://local/05 Writeups/demo/images/a.png');
  assert.equal(resolve('./images/a.png'), 'app://local/05 Writeups/demo/images/a.png');
  assert.equal(resolve('images/missing.png'), null);
});
