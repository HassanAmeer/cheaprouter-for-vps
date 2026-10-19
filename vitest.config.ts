import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "src/app/**/__tests__/**/*.test.tsx",
      "src/app/**/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@cheaproute/open-sse": resolve(__dirname, "./open-sse"),
    },
  },
});
