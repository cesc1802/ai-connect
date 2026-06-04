import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '..');

/**
 * Token-only lint (NFR-026, C-021, C-026). New sidebar + layout surfaces
 * must drive color and typography from CSS custom properties, never from
 * raw hex / rgb literals or hard-coded font-family declarations.
 *
 * Allowed: utility classes (text-sidebar-foreground, bg-sidebar, etc.),
 * arbitrary tokens (text-[var(--…)]), Tailwind size/spacing literals.
 * Forbidden: #rrggbb, rgb(), rgba(), font-family:.
 */
const GLOBS = [
  'components/sidebar/**/*.{ts,tsx}',
  'components/layout/sidebar.tsx',
  'components/layout/app-shell.tsx',
  'pages/no-workspace-guard-page.tsx',
  'pages/workspaces-new-page.tsx',
];

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const RGB_PATTERN = /\brgba?\s*\(/;
const FONT_FAMILY_PATTERN = /font-family\s*:/i;

function listFiles(): string[] {
  return GLOBS.flatMap((g) => globSync(g, { cwd: srcDir })).map((rel) =>
    resolve(srcDir, rel),
  );
}

describe('Sidebar token-only lint', () => {
  const files = listFiles();

  it('inventory covers at least the expected core files', () => {
    expect(files.length).toBeGreaterThan(5);
    const joined = files.join('\n');
    expect(joined).toMatch(/components\/sidebar\/sidebar-account-menu\.tsx/);
    expect(joined).toMatch(/components\/sidebar\/org-sections\.tsx/);
    expect(joined).toMatch(/components\/layout\/sidebar\.tsx/);
  });

  for (const file of files) {
    it(`${file.replace(srcDir + '/', '')} uses only design tokens`, () => {
      const content = readFileSync(file, 'utf8');
      // Strip line comments so a `// #foo` documentation note is not flagged.
      const sanitized = content
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
      expect(sanitized, 'no #hex color literal').not.toMatch(HEX_PATTERN);
      expect(sanitized, 'no rgb()/rgba() literal').not.toMatch(RGB_PATTERN);
      expect(sanitized, 'no font-family declaration').not.toMatch(
        FONT_FAMILY_PATTERN,
      );
    });
  }
});
