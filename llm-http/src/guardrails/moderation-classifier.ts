import { LLMGateway } from "llm-gateway";
import type { ChatRequest, ChatResponse, ModerationVerdict, ProviderName } from "llm-gateway";

/**
 * Minimal gateway seam the classifier needs — just a non-streaming `chat`.
 * Declaring it (rather than depending on the full `LLMGateway`) keeps the
 * classifier unit-testable with a stub and documents the single call it makes.
 */
export interface ModerationGateway {
  chat(req: ChatRequest): Promise<ChatResponse>;
}

const SYSTEM_PROMPT =
  "You are a strict content-moderation classifier. Decide whether the user " +
  "content violates a typical usage policy (hate, harassment, sexual, " +
  "self-harm, violence, illicit, or dangerous content). Respond with ONLY a " +
  'compact JSON object of the form {"flagged": boolean, "categories": ' +
  'string[]} using short lowercase category labels. Output no prose.';

/**
 * Classifies outbound text via a dedicated LLM gateway. Used as the injected
 * `moderate()` seam for the moderation guardrail check. A thrown error here is
 * the contract for "moderation unavailable" — the check decides fail-open vs
 * fail-closed, so this method only returns on a confidently parsed verdict.
 */
export class ModerationClassifier {
  constructor(
    private readonly gateway: ModerationGateway,
    private readonly model: string,
  ) {}

  moderate = async (text: string): Promise<ModerationVerdict> => {
    const res = await this.gateway.chat({
      model: this.model,
      maxTokens: 200,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });
    return parseVerdict(res.content);
  };
}

/** Extracts `{flagged, categories}` from the model's JSON reply. Throws if absent. */
export function parseVerdict(content: string): ModerationVerdict {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("moderation classifier returned no JSON verdict");
  const parsed = JSON.parse(match[0]) as { flagged?: unknown; categories?: unknown };
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter((c): c is string => typeof c === "string")
    : [];
  return { flagged: parsed.flagged === true, categories };
}

export interface ModerationGatewayConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
}

/**
 * Builds a dedicated `LLMGateway` (separate credentials, static config) and a
 * `ModerationClassifier` bound to it. Returns the gateway too so the container
 * can dispose it on shutdown. Isolated from the chat gateway by construction.
 */
export function createModerationClassifier(cfg: ModerationGatewayConfig): {
  classifier: ModerationClassifier;
  gateway: LLMGateway;
} {
  const gateway = new LLMGateway({
    providers: providerConfigFor(cfg),
    defaultProvider: cfg.provider,
  });
  return { classifier: new ModerationClassifier(gateway, cfg.model), gateway };
}

/** Maps the configured provider kind to the gateway's static provider entry. */
function providerConfigFor(cfg: ModerationGatewayConfig) {
  switch (cfg.provider) {
    case "ollama":
      return { ollama: { baseUrl: cfg.baseUrl ?? "http://localhost:11434" } };
    case "anthropic":
      return { anthropic: keyEntry(cfg) };
    case "openai":
      return { openai: keyEntry(cfg) };
    case "minimax":
      return { minimax: keyEntry(cfg) };
  }
}

function keyEntry(cfg: ModerationGatewayConfig): { apiKey: string; baseUrl?: string } {
  if (!cfg.apiKey) {
    throw new Error(`MODERATION_API_KEY is required for provider "${cfg.provider}"`);
  }
  return { apiKey: cfg.apiKey, ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}) };
}
