import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '..', 'index.css');
const css = readFileSync(cssPath, 'utf8');

describe('design tokens (index.css)', () => {
  it('declares the terracotta-orange primary in :root', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--primary:\s*oklch\(0\.62 0\.19 38\)/s);
  });

  it('declares a .dark theme block', () => {
    expect(css).toMatch(/\.dark\s*\{/);
  });

  it('sets the base radius to 0.75rem', () => {
    expect(css).toMatch(/--radius:\s*0\.75rem/);
  });

  it('re-exports tokens under @theme inline', () => {
    expect(css).toMatch(/@theme inline\s*\{/);
    expect(css).toMatch(/--color-background:\s*var\(--background\)/);
    expect(css).toMatch(/--color-primary:\s*var\(--primary\)/);
  });

  it('registers the dark custom variant', () => {
    expect(css).toMatch(/@custom-variant dark/);
  });
});
