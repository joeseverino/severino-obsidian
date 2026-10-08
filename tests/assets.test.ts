import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TAbstractFile } from 'obsidian';
import { assetReport } from '../src/assets.ts';
import { attach, makeFile, makeFolder } from './helpers.ts';

function vaultWith(images: string[]) {
  const folder = makeFolder('05 Writeups/demo');
  const index = attach(makeFile('05 Writeups/demo/index.md'), folder);
  const imageDir = makeFolder(
    '05 Writeups/demo/images',
    images.map((name) => makeFile(`05 Writeups/demo/images/${name}`)),
  );
  const app = {
    vault: {
      getAbstractFileByPath: (path: string): TAbstractFile | null =>
        path === imageDir.path ? imageDir : null,
    },
  };
  return { app, index };
}

test('every image referenced and present is clean', () => {
  const { app, index } = vaultWith(['a.png', 'b.png']);
  const report = assetReport(app, index, '![one](images/a.png)\n![two|320](./images/b.png)');
  assert.deepEqual(report.orphans, []);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.present, ['images/a.png', 'images/b.png']);
});

test('reports orphans and missing references, sorted', () => {
  const { app, index } = vaultWith(['z.png', 'a.png', 'used.png']);
  const report = assetReport(app, index, '![](images/used.png)\n![](images/gone2.png)\n![](images/gone1.png)');
  assert.deepEqual(report.orphans, ['images/a.png', 'images/z.png']);
  assert.deepEqual(report.missing, ['images/gone1.png', 'images/gone2.png']);
});

test('raw img tags and the frontmatter cover image count as references', () => {
  const { app, index } = vaultWith(['cover.png', 'raw.png']);
  const markdown = ['---', 'cover_image: "images/cover.png"', '---', '<img class="x" src="./images/raw.png">'].join('\n');
  const report = assetReport(app, index, markdown);
  assert.deepEqual(report.orphans, []);
  assert.deepEqual(report.missing, []);
});

test('remote and non-images references are ignored', () => {
  const { app, index } = vaultWith([]);
  const report = assetReport(app, index, '![x](https://example.com/images/x.png)\n![y](other/y.png)');
  assert.deepEqual(report.referenced, []);
});

test('a writeup without an images folder has nothing present', () => {
  const folder = makeFolder('05 Writeups/bare');
  const index = attach(makeFile('05 Writeups/bare/index.md'), folder);
  const app = { vault: { getAbstractFileByPath: (): TAbstractFile | null => null } };
  const report = assetReport(app, index, '![x](images/x.png)');
  assert.deepEqual(report.present, []);
  assert.deepEqual(report.missing, ['images/x.png']);
});
