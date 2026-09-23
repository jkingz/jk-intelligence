import { expect, test } from "@playwright/test";

// Targets measured against a placeholder-env build, not inferred: spec §7's table.
test("an anonymous /dashboard visit lands on login with the return path", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});

test("an anonymous /profile visit is guarded the same way", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fprofile$/);
});
