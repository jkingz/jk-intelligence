import { expect, test } from "@playwright/test";

test("landing renders the headline and the feature grid", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/JK Intelligence/);
  await expect(
    page.getByRole("heading", { level: 1, name: /organic performance, in one dashboard/ }),
  ).toBeVisible();
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
