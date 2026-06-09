// Env-driven configuration for the database client.
// Keep reads explicit so misconfiguration fails fast with a clear message.

const DEFAULT_POOL_MAX = 10;

/** Returns DATABASE_URL or throws if it is unset/empty. */
export function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[llm-db] DATABASE_URL is not set");
  }
  return url;
}

/** Parses DATABASE_POOL_MAX; defaults to 10; throws on a non-positive integer. */
export function readPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") {
    return DEFAULT_POOL_MAX;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[llm-db] DATABASE_POOL_MAX must be a positive integer, got "${raw}"`,
    );
  }
  return value;
}
