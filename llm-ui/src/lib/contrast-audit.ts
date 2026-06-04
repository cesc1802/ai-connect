export type TokenMap = Record<string, string>;

export interface ContrastPair {
  scope: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  pass: boolean;
}

const OKLCH_RE = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/;
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/;
const DARK_BLOCK = /\.dark\s*\{([^}]*)\}/;
const TOKEN_LINE = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;

export function parseTokens(css: string): { light: TokenMap; dark: TokenMap } {
  const rootMatch = ROOT_BLOCK.exec(css);
  const darkMatch = DARK_BLOCK.exec(css);
  return {
    light: rootMatch ? readBlock(rootMatch[1]!) : {},
    dark: darkMatch ? readBlock(darkMatch[1]!) : {},
  };
}

function readBlock(block: string): TokenMap {
  const out: TokenMap = {};
  let m: RegExpExecArray | null;
  TOKEN_LINE.lastIndex = 0;
  while ((m = TOKEN_LINE.exec(block)) !== null) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

export function oklchToSrgb(value: string): [number, number, number] | null {
  const m = OKLCH_RE.exec(value);
  if (!m) return null;
  const L = parseFloat(m[1]!);
  const C = parseFloat(m[2]!);
  const hDeg = parseFloat(m[3]!);
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab -> LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  // LMS -> linear sRGB
  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return [clamp01(r), clamp01(g), clamp01(bl)];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  // r, g, b are already linear sRGB from oklchToSrgb (no gamma transform).
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number | null {
  const f = oklchToSrgb(fg);
  const b = oklchToSrgb(bg);
  if (!f || !b) return null;
  const lf = relativeLuminance(f);
  const lb = relativeLuminance(b);
  const light = Math.max(lf, lb);
  const dark = Math.min(lf, lb);
  return (light + 0.05) / (dark + 0.05);
}

const PAIRS: Array<{ fg: string; bg: string; required: number }> = [
  { fg: 'foreground', bg: 'background', required: 4.5 },
  { fg: 'card-foreground', bg: 'card', required: 4.5 },
  { fg: 'popover-foreground', bg: 'popover', required: 4.5 },
  { fg: 'primary-foreground', bg: 'primary', required: 4.5 },
  { fg: 'secondary-foreground', bg: 'secondary', required: 4.5 },
  { fg: 'muted-foreground', bg: 'muted', required: 4.5 },
  { fg: 'accent-foreground', bg: 'accent', required: 4.5 },
  { fg: 'destructive-foreground', bg: 'destructive', required: 4.5 },
  { fg: 'success-foreground', bg: 'success', required: 4.5 },
  { fg: 'warning-foreground', bg: 'warning', required: 4.5 },
  { fg: 'sidebar-foreground', bg: 'sidebar', required: 4.5 },
  { fg: 'sidebar-accent-foreground', bg: 'sidebar-accent', required: 4.5 },
];

export function auditPairs(tokens: TokenMap, scope: string): ContrastPair[] {
  const out: ContrastPair[] = [];
  for (const p of PAIRS) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio == null) continue;
    out.push({
      scope,
      fg: p.fg,
      bg: p.bg,
      ratio: Math.round(ratio * 100) / 100,
      required: p.required,
      pass: ratio >= p.required,
    });
  }
  return out;
}

export function auditCss(css: string): ContrastPair[] {
  const { light, dark } = parseTokens(css);
  return [...auditPairs(light, 'light'), ...auditPairs(dark, 'dark')];
}
