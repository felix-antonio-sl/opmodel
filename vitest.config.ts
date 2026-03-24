import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": '"test"',
  },
  test: {
    globals: true,
    include: ["packages/*/tests/**/*.test.ts"],
  },
});
