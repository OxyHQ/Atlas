import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { measureJavaScript } from './compare-js-bundles.mjs';

test('measures nested JavaScript and ignores other assets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-js-measure-'));
  try {
    mkdirSync(join(directory, 'nested'));
    const first = Buffer.from('console.log("one");');
    const second = Buffer.from('console.log("two");');
    writeFileSync(join(directory, 'first.js'), first);
    writeFileSync(join(directory, 'nested', 'second.js'), second);
    writeFileSync(join(directory, 'nested', 'ignored.css'), 'body{}');
    assert.deepEqual(measureJavaScript(directory), {
      files: 2,
      rawBytes: first.length + second.length,
      gzipBytes:
        gzipSync(first, { level: 9, mtime: 0 }).length +
        gzipSync(second, { level: 9, mtime: 0 }).length,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects an export without JavaScript', () => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-js-empty-'));
  try {
    assert.throws(() => measureJavaScript(directory), /No JavaScript/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
