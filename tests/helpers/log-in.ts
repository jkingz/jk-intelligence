import { expect, type Page } from "@playwright/test";

type FixtureRole = "demo" | "admin";

const CRED_ENV: Record<FixtureRole, [string, string]> = {
  demo: ["DEMO_EMAIL", "DEMO_PASSWORD"],
  admin: ["ADMIN_EMAIL", "ADMIN_PASSWORD"],
};

export async function logIn(page: Page, role: FixtureRole = "demo") {
  const [emailName, passwordName] = CRED_ENV[role];
  const email = process.env[emailName];
  const password = process.env[passwordName];
  if (!email || !password) {
    throw new Error(`${emailName} / ${passwordName} are not in the environment`);
  }
  await page.goto("/auth/login");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  // Every role lands on /dashboard; an admin spec navigates from there. The
  // admin's own users row has client_id = null, so the dashboard paints its
  // empty shell — asserting the URL is still the honest check.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}
