/**
 * Derives the UI icon token from a provider catalog name.
 * Matching is case-insensitive substring. Falls back to "package".
 */
export function iconFromCatalogName(catalogName: string): string {
  const lower = catalogName.toLowerCase();
  if (lower.includes("openai")) return "sparkles";
  if (lower.includes("anthropic")) return "bot";
  if (lower.includes("ollama")) return "hard-drive";
  return "package";
}
