import { expect, test } from "@playwright/test";

test("the login form is served to an anonymous visitor", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(page).toHaveTitle(/Sign in/);
  const form = page.getByRole("form", { name: "Sign in" });
  await expect(form.getByLabel("Email")).toBeVisible();
  await expect(form.getByLabel("Password")).toBeVisible();
});

test("empty submission is blocked client-side and does not navigate", async ({ page }) => {
  await page.goto("/auth/login");
  // `exact` because the page also offers a separate "Sign in as demo" button.
  await page
    .getByRole("form", { name: "Sign in" })
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});
