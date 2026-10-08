import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintFrontmatter, type VaultSchema } from '../src/schema.ts';

const schema: VaultSchema = {
  doc_id_prefixes: ['PRJ'],
  doc_types: ['project', 'runbook'],
  environments: ['prod', 'lab'],
  required_fields: ['doc_id', 'doc_type', 'status'],
  sensitivities: ['public', 'internal'],
  statuses: ['active', 'archived'],
  task_statuses: ['open', 'done'],
};

test('valid frontmatter passes', () => {
  const lint = lintFrontmatter({ doc_id: 'PRJ-1', doc_type: 'project', status: 'active', sensitivity: 'internal' }, schema);
  assert.deepEqual(lint, { ok: true, missingRequired: [], invalidEnums: [] });
});

test('missing, null and empty required fields are reported', () => {
  const lint = lintFrontmatter({ doc_id: '', doc_type: null }, schema);
  assert.equal(lint.ok, false);
  assert.deepEqual(lint.missingRequired, ['doc_id', 'doc_type', 'status']);
});

test('values outside an enum are reported with the allowed set', () => {
  const lint = lintFrontmatter({ doc_id: 'x', doc_type: 'project', status: 'wip', environment: 'prod' }, schema);
  assert.deepEqual(lint.invalidEnums, ['status: wip (not in active / archived)']);
  assert.equal(lint.ok, false);
});

test('non-string enum values are not judged', () => {
  const lint = lintFrontmatter({ doc_id: 'x', doc_type: 'project', status: 'active', environment: 5 }, schema);
  assert.equal(lint.ok, true);
});
