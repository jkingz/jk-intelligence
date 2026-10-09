import { expect, test } from "@playwright/test";

// Unlike connections-guard.spec.ts, this destination is deliberately absent from
// the rail (the rail's account block is its only entry), so nothing else in the test
// suite would notice a dropped prefix. proxy.ts decides on the path, not the route
// table, which is why this passes while /admin itself is still 404 for everyone.
test("an anonymous /admin visit lands on login with the return path", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fadmin$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});

test("anonymous /admin never renders provisioning copy", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Provisioning" })).toHaveCount(0);
});
