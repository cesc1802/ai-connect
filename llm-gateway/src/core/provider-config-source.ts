import type { ProviderConfig } from "./config.js";

/**
 * Pluggable source of provider configuration. The gateway re-reads it on use
 * once the refresh TTL lapses and reconciles its provider registry with the
 * result. Implementations live outside this package (e.g. a database-backed
 * source), keeping the gateway free of storage concerns.
 */
export interface ProviderConfigSource {
  /** Return the full set of enabled providers in a single call. */
  load(): Promise<ProviderConfig>;
}
