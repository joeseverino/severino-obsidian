import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrayOf, isBoolean, isNumber, isRecord, isString, optional, shape } from '../src/guards.ts';

test('isRecord rejects arrays and null', () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord('x'), false);
});

test('arrayOf checks every element', () => {
  assert.equal(arrayOf(isString)(['a', 'b']), true);
  assert.equal(arrayOf(isString)(['a', 1]), false);
  assert.equal(arrayOf(isString)('a'), false);
});

test('shape requires present fields and allows absent optional ones', () => {
  const guard = shape({ ok: isBoolean, count: optional(isNumber), tags: arrayOf(isString) });
  assert.equal(guard({ ok: true, tags: [] }), true);
  assert.equal(guard({ ok: true, count: 2, tags: ['x'], extra: 1 }), true);
  assert.equal(guard({ ok: true }), false);
  assert.equal(guard({ ok: true, count: '2', tags: [] }), false);
  assert.equal(guard([]), false);
});

test('shapes nest', () => {
  const guard = shape({ inner: optional(shape({ n: isNumber })) });
  assert.equal(guard({}), true);
  assert.equal(guard({ inner: { n: 1 } }), true);
  assert.equal(guard({ inner: { n: 'x' } }), false);
});
