import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Bare "server-only" resolves via `main` (the throwing guard) instead of
      // the react-server export condition under vitest — point it at the no-op.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
    conditions: ["react-server"],
  },
  test: {
    environment: "node",
    clearMocks: true,
    exclude: [
      "**/node_modules/**",
      "**/.agents/**",
      "**/.claude/**",
      "**/.playwright/**",
    ],
  },
});
