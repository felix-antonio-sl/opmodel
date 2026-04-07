import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@opmodel/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@opmodel/nl": path.resolve(__dirname, "../nl/src/index.ts"),
    },
  },
});
