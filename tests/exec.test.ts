import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { isBoolean, shape } from '../src/guards.ts';

// exec.ts resolves tools under $HOME/.local/bin when it loads, so the fake
// tools exist before the module is imported.
const home = await mkdtemp(path.join(tmpdir(), 'svo-exec-'));
const bin = path.join(home, '.local/bin');
await mkdir(bin, { recursive: true });

async function tool(name: string, script: string): Promise<void> {
  const file = path.join(bin, name);
  await writeFile(file, `#!/bin/sh\n${script}\n`);
  await chmod(file, 0o755);
}

await tool('echo-json', 'echo \'{"ok":true}\'');
await tool('cat-stdin', 'cat');
await tool('fail-json', 'echo \'{"ok":false}\'; echo boom >&2; exit 3');
await tool('not-json', 'echo hello');
await tool('wrong-shape', 'echo \'{"ok":"yes"}\'');
await tool('fail-quiet', 'echo oops >&2; exit 1');

process.env.HOME = home;
const { runTool, runToolJson } = await import('../src/exec.ts');
const isOk = shape({ ok: isBoolean });
const cwd = home;

test('runTool returns stdout of a successful tool', async () => {
  const result = await runTool('echo-json', [], { cwd });
  assert.deepEqual(result, { ok: true, stdout: '{"ok":true}\n', stderr: '' });
});

test('runTool writes input to stdin and closes it', async () => {
  const result = await runTool('cat-stdin', [], { cwd, input: 'piped' });
  assert.equal(result.stdout, 'piped');
});

test('runTool keeps stdout and stderr when the tool exits non-zero', async () => {
  const result = await runTool('fail-json', [], { cwd });
  assert.equal(result.ok, false);
  assert.equal(result.stdout, '{"ok":false}\n');
  assert.match(result.stderr, /boom/);
});

test('runTool reports a missing tool as a failure', async () => {
  const result = await runTool('does-not-exist', [], { cwd });
  assert.equal(result.ok, false);
  assert.match(result.stderr, /ENOENT/);
});

test('runToolJson returns data that satisfies the guard', async () => {
  assert.deepEqual(await runToolJson('echo-json', [], isOk, { cwd }), { ok: true, data: { ok: true } });
});

test('runToolJson parses stdout even when the exit code is non-zero', async () => {
  assert.deepEqual(await runToolJson('fail-json', [], isOk, { cwd }), { ok: true, data: { ok: false } });
});

test('runToolJson rejects output that is not JSON', async () => {
  const result = await runToolJson('not-json', [], isOk, { cwd });
  assert.deepEqual(result, { ok: false, error: 'No parseable output' });
});

test('runToolJson rejects JSON of the wrong shape', async () => {
  const result = await runToolJson('wrong-shape', [], isOk, { cwd });
  assert.equal(result.ok, false);
  assert.equal(result.data, undefined);
});

test('runToolJson falls back to stderr', async () => {
  const result = await runToolJson('fail-quiet', [], isOk, { cwd });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /oops/);
});
