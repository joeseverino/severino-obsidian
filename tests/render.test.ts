import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPreviewDoc, isSiteRender } from '../src/render.ts';

const resolveAsset = (rel: string): string | null => (rel === 'images/a.png' ? 'app://local/a.png' : null);

test('site-form asset URLs point at local files', async () => {
  const html = await buildPreviewDoc({
    markdown: '',
    slug: 'demo',
    resolveAsset,
    renderDocument: async () => '<img src="/assets/writeups/demo/images/a.png"><a href="/assets/writeups/demo/images/b.png">',
  });
  assert.equal(html, '<img src="app://local/a.png"><a href="/assets/writeups/demo/images/b.png">');
});

test('folder-relative URLs resolve, absolute and anchor URLs do not', async () => {
  const html = await buildPreviewDoc({
    markdown: '',
    slug: 'demo',
    resolveAsset,
    renderDocument: async () =>
      '<img src="./images/a.png"><img src="images/a.png"><a href="https://x.test/a.png"><a href="#top"><a href="/rooted">',
  });
  assert.equal(
    html,
    '<img src="app://local/a.png"><img src="app://local/a.png"><a href="https://x.test/a.png"><a href="#top"><a href="/rooted">',
  );
});

test('a failed render becomes an escaped error page', async () => {
  const html = await buildPreviewDoc({
    markdown: '',
    slug: 'demo',
    resolveAsset,
    renderDocument: async () => {
      throw new Error('bad <tag> & more');
    },
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Preview failed to render:/);
  assert.match(html, /bad &lt;tag&gt; &amp; more/);
});

test('the renderer receives the markdown unchanged', async () => {
  let seen = '';
  await buildPreviewDoc({
    markdown: '# Title',
    slug: 'demo',
    resolveAsset,
    renderDocument: async (markdown) => {
      seen = markdown;
      return '';
    },
  });
  assert.equal(seen, '# Title');
});

test('isSiteRender checks the fields it reads', () => {
  assert.equal(isSiteRender({ ok: true, document: '<p>' }), true);
  assert.equal(isSiteRender({ ok: false, error: { message: 'x' } }), true);
  assert.equal(isSiteRender({}), true);
  assert.equal(isSiteRender({ document: 3 }), false);
  assert.equal(isSiteRender({ error: 'x' }), false);
  assert.equal(isSiteRender(null), false);
});
