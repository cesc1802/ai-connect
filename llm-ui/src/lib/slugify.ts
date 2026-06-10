// Diacritic-stripping slug derivation shared by workspace forms. Mirrors the
// backend slug rules (lowercase alphanumerics separated by single hyphens,
// max 50 chars) so client-derived slugs always pass server validation.
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

// Deterministic warm-ish hue from a string so workspace emblems stay stable
// across renders and sessions without persisting a color.
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
