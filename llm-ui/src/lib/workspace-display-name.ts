// Compact workspace label: org convention prefixes names with "Dự Án ";
// strip it when present, otherwise return the name untouched.
export function wsShortName(name: string): string {
  const short = name.replace(/^Dự Án /, "").trim();
  return short || name;
}
