import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Point at compiled output: the source uses NodeNext `.js` import specifiers
  // which drizzle-kit's loader cannot map back to `.ts`. The build emits real
  // `.js` files, so Node resolves the schema graph cleanly. Run build first.
  schema: "./dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
