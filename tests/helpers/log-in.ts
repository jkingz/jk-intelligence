import { expect, type Page } from "@playwright/test";

export async function logIn(page: Page) {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "DEMO_EMAIL / DEMO_PASSWORD are not in the environment",
    );
  }
  await page.goto("/auth/login");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}
