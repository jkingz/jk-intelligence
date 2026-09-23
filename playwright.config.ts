import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/e2e/**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "dot" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "public", use: { ...devices["Desktop Chrome"] }, grepInvert: /@auth/ },
    {
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      grep: /@auth/,
      dependencies: ["public"],
    },
  ],
  webServer: {
    command: isCI ? "pnpm start -p 3000" : "pnpm dev -p 3000",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
