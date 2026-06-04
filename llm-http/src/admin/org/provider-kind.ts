export const PROVIDER_KINDS = [
  "openai",
  "anthropic",
  "google",
  "azure-openai",
  "custom",
] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export function isProviderKind(value: unknown): value is ProviderKind {
  return (
    typeof value === "string" &&
    (PROVIDER_KINDS as readonly string[]).includes(value)
  );
}
