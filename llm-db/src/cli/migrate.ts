// CLI entry: apply pending migrations then close the pool.
// Run via `pnpm db:migrate` (tsx in dev/CI) or the compiled dist in prod.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readDatabaseUrl } from "../env.js";
import { createDbClient } from "../client.js";

const client = createDbClient({ url: readDatabaseUrl() });
try {
  await migrate(client.db, { migrationsFolder: "./drizzle" });
  console.log("[llm-db] migrations applied");
} finally {
  await client.close();
}
