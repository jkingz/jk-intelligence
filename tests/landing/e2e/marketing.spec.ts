import { expect, test } from "@playwright/test";

test("landing renders the headline and the feature grid", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/JK Intelligence/);
  await expect(
    page.getByRole("heading", { level: 1, name: /organic performance, in one dashboard/ }),
  ).toBeVisible();
});

test("both hero and trust-band CTAs reach the demo sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Get started", exact: true })).toHaveAttribute(
    "href",
    "/auth/login",
  );
  await expect(page.getByRole("link", { name: "Get started free" })).toHaveAttribute(
    "href",
    "/auth/login",
  );
  // The sentence is the only thing telling a visitor a demo exists, and it must
  // not depend on DEMO_EMAIL (CI has none) the way the login page's card does.
  await expect(page.getByText(/No account needed/)).toBeVisible();
});

test("footer reaches both legal pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Terms & Conditions" }).click();
  await expect(page).toHaveURL(/\/terms$/);
});
