import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectEffects, needsConfirm } from '../src/cordon.ts';

test('collects name/effect pairs from nested contracts', () => {
  const contract = {
    tools: [
      { name: 'site', effect: 'read', commands: [{ name: 'sync', effect: 'vault_write' }, { name: 'land', effect: 'deploy' }] },
      { name: 'brand', effect: 'local_write', commands: [{ name: 'figure', effect: 'local_write' }] },
    ],
  };
  const map = collectEffects(contract);
  assert.equal(map.get('site'), 'read');
  assert.equal(map.get('sync'), 'vault_write');
  assert.equal(map.get('site sync'), 'vault_write');
  assert.equal(map.get('brand figure'), 'local_write');
  assert.equal(map.get('site land'), 'deploy');
});

test('ignores values without a string name and effect', () => {
  const map = collectEffects([null, 3, 'x', { name: 'a' }, { effect: 'read' }, { name: 1, effect: 'read' }]);
  assert.equal(map.size, 0);
});

test('only remote_write and deploy ask for confirmation', () => {
  assert.equal(needsConfirm('read'), false);
  assert.equal(needsConfirm('local_write'), false);
  assert.equal(needsConfirm('vault_write'), false);
  assert.equal(needsConfirm('unknown'), false);
  assert.equal(needsConfirm('remote_write'), true);
  assert.equal(needsConfirm('deploy'), true);
});
