import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/** Measure all emitted JavaScript; this is not an estimate of initial page transfer. */
export function measureJavaScript(directory) {
  let files = 0;
  let rawBytes = 0;
  let gzipBytes = 0;
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = readFileSync(path);
        files += 1;
        rawBytes += content.length;
        gzipBytes += gzipSync(content, { level: 9, mtime: 0 }).length;
      }
    }
  }
  visit(directory);
  if (files === 0) throw new Error(`No JavaScript found in ${directory}`);
  return { files, rawBytes, gzipBytes };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [baseline, candidate] = process.argv.slice(2);
  if (!baseline || !candidate)
    throw new Error('usage: compare-js-bundles.mjs <baseline> <candidate>');
  const before = measureJavaScript(baseline);
  const after = measureJavaScript(candidate);
  console.log(
    JSON.stringify(
      {
        before,
        after,
        delta: {
          files: after.files - before.files,
          rawBytes: after.rawBytes - before.rawBytes,
          gzipBytes: after.gzipBytes - before.gzipBytes,
        },
      },
      null,
      2,
    ),
  );
}
