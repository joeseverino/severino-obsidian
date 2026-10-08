#!/usr/bin/env node
// One version, one bumper. release-please bumps package.json (release-type:
// node); this script derives the two files Obsidian actually reads — manifest.json
// (the runtime version) and versions.json (the version → minAppVersion map) — from
// it, so the four-files-that-disagree problem can't come back.
//
//   node scripts/sync-version.ts           # write manifest.json + versions.json from package.json
//   node scripts/sync-version.ts --check   # exit 1 if they drift (the cordon gate)
//
// The release PR (release-please bumping package.json) is the one place drift
// appears; the `version:check` gate makes that PR red until `npm run version:sync`
// is committed onto it, so a mismatched manifest can never ship.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { isRecord } from '../src/guards.ts';

const root = path.resolve(import.meta.dirname, '..');
const read = (f: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  if (!isRecord(parsed)) throw new Error(`${f} is not a JSON object`);
  return parsed;
};

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
const check = values.check;
const pkg = read('package.json');
const manifest = read('manifest.json');
const versions = read('versions.json');

const version = pkg.version;
if (typeof version !== 'string' || !version) {
  console.error('✗ package.json has no "version" — it is the canonical bump source.');
  process.exit(1);
}

const minApp = manifest.minAppVersion;
const drift: string[] = [];
if (manifest.version !== version) {
  drift.push(`manifest.json version ${manifest.version} ≠ package.json ${version}`);
}
if (versions[version] !== minApp) {
  drift.push(`versions.json is missing { "${version}": "${minApp}" }`);
}

if (check) {
  if (drift.length) {
    console.error('✗ version drift:\n  ' + drift.join('\n  '));
    console.error('  Fix: npm run version:sync && git add manifest.json versions.json');
    process.exit(1);
  }
  console.log(`✓ version in lockstep at ${version}`);
  process.exit(0);
}

// write mode — derive manifest.json + versions.json from package.json
manifest.version = version;
versions[version] = minApp;
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'versions.json'), JSON.stringify(versions, null, 2) + '\n');
console.log(`✓ synced manifest.json + versions.json to ${version}`);
