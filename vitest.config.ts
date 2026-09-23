import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolve = {
  alias: {
    "@": fileURLToPath(new URL(".", import.meta.url)),
    // Bare "server-only" resolves via `main` (the throwing guard) instead of
    // the react-server export condition under vitest — point it at the no-op.
    "server-only": fileURLToPath(
      new URL("./node_modules/server-only/empty.js", import.meta.url),
    ),
  },
  conditions: ["react-server"],
};

export default defineConfig({
  resolve,
  test: {
    environment: "node",
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/*/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/*/integration/**/*.test.ts"],
          setupFiles: ["tests/helpers/load-test-env.ts"],
        },
      },
    ],
  },
});
