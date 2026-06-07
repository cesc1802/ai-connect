import { defineConfig } from "vitest/config";
import path from "node:path";

// Node env for ws-client unit tests (no DOM needed). Component tests
// added in later phases can override per-file via /* @vitest-environment jsdom */.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
