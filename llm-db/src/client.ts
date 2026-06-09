import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

export interface DbClient {
  db: PostgresJsDatabase<typeof schema>;
  sql: postgres.Sql;
  /** Awaits in-flight queries then ends the pool. */
  close(): Promise<void>;
}

export interface CreateDbClientOptions {
  url: string;
  poolMax?: number;
}

/**
 * Builds a Drizzle client over the postgres-js driver. No singleton is kept —
 * the caller owns the lifetime and must call close() on shutdown.
 */
export function createDbClient(opts: CreateDbClientOptions): DbClient {
  const sql = postgres(opts.url, { max: opts.poolMax ?? 10 });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
