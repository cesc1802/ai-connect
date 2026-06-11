import { api } from "./api";

// Typed wrapper over GET /api/me/default-model — the chat screen hides the
// model picker and sends to this model. Null when no provider is usable.

export function getMyDefaultModel(): Promise<string | null> {
  return api.get<{ model: string | null }>("/api/me/default-model").then((r) => r.model);
}
