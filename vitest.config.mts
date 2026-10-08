import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Unit tests must never call the real API (cost, flakiness); the evals do that.
    env: { OPENAI_API_KEY: "test-key-not-used" },
  },
});
