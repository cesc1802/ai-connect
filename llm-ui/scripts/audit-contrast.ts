#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditCss } from '../src/lib/contrast-audit.js';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '..', 'src', 'index.css');
const css = readFileSync(cssPath, 'utf8');

const results = auditCss(css);
const failures = results.filter((r) => !r.pass);

for (const r of results) {
  const flag = r.pass ? 'PASS' : 'FAIL';
  console.log(
    `${flag}  ${r.scope.padEnd(5)} ${r.fg.padEnd(28)} on ${r.bg.padEnd(20)} ratio=${r.ratio.toFixed(2)} required>=${r.required}`,
  );
}

if (failures.length > 0) {
  console.error(`\nContrast audit failed for ${failures.length} pair(s).`);
  process.exit(1);
}

console.log(`\nContrast audit passed for ${results.length} pairs.`);
