import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  auditCss,
  auditPairs,
  contrastRatio,
  oklchToSrgb,
  parseTokens,
} from '@/lib/contrast-audit';

describe('contrast-audit', () => {
  describe('oklchToSrgb', () => {
    it('maps white OKLCH to linear sRGB (1,1,1)', () => {
      const v = oklchToSrgb('oklch(1 0 0)')!;
      expect(v[0]).toBeCloseTo(1, 2);
      expect(v[1]).toBeCloseTo(1, 2);
      expect(v[2]).toBeCloseTo(1, 2);
    });

    it('maps black OKLCH to linear sRGB (0,0,0)', () => {
      const v = oklchToSrgb('oklch(0 0 0)')!;
      expect(v[0]).toBeCloseTo(0, 2);
      expect(v[1]).toBeCloseTo(0, 2);
      expect(v[2]).toBeCloseTo(0, 2);
    });

    it('returns null for non-oklch input', () => {
      expect(oklchToSrgb('#ffffff')).toBeNull();
    });
  });

  describe('contrastRatio', () => {
    it('returns 21 for white on black', () => {
      const r = contrastRatio('oklch(1 0 0)', 'oklch(0 0 0)')!;
      expect(r).toBeGreaterThan(20);
    });

    it('returns 1 for same colours', () => {
      const r = contrastRatio('oklch(0.5 0 0)', 'oklch(0.5 0 0)')!;
      expect(r).toBeCloseTo(1, 1);
    });

    it('is symmetric in fg/bg', () => {
      const a = contrastRatio('oklch(0.2 0 0)', 'oklch(0.9 0 0)')!;
      const b = contrastRatio('oklch(0.9 0 0)', 'oklch(0.2 0 0)')!;
      expect(a).toBeCloseTo(b, 5);
    });
  });

  describe('parseTokens', () => {
    it('separates :root and .dark blocks', () => {
      const css = `
        :root { --background: oklch(0.97 0 0); --foreground: oklch(0.17 0 0); }
        .dark { --background: oklch(0.15 0 0); --foreground: oklch(0.94 0 0); }
      `;
      const { light, dark } = parseTokens(css);
      expect(light['background']).toBe('oklch(0.97 0 0)');
      expect(dark['background']).toBe('oklch(0.15 0 0)');
    });
  });

  describe('auditPairs', () => {
    it('flags failing pairs', () => {
      const result = auditPairs(
        {
          foreground: 'oklch(0.5 0 0)',
          background: 'oklch(0.5 0 0)',
        },
        'light',
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.pass).toBe(false);
    });

    it('passes high-contrast pairs', () => {
      const result = auditPairs(
        {
          foreground: 'oklch(1 0 0)',
          background: 'oklch(0 0 0)',
        },
        'light',
      );
      expect(result[0]!.pass).toBe(true);
      expect(result[0]!.ratio).toBeGreaterThan(20);
    });
  });

  describe('production index.css', () => {
    it('audits every defined pair and reports zero failures', () => {
      const css = readFileSync(
        resolve(__dirname, '..', 'index.css'),
        'utf8',
      );
      const results = auditCss(css);
      const failures = results.filter((r) => !r.pass);
      if (failures.length > 0) {
        const summary = failures
          .map(
            (f) =>
              `[${f.scope}] ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)} < ${f.required}`,
          )
          .join('\n');
        throw new Error(`Contrast failures:\n${summary}`);
      }
      expect(failures).toEqual([]);
    });
  });
});
