import { expect, test } from "@playwright/test";

// A destination that renders in the rail must bounce anonymous visitors before
// it ever reaches a page module — this passes while /connections 404s for a
// signed-in user, because proxy.ts decides on the path, not the route table.
test("an anonymous /connections visit lands on login with the return path", async ({
  page,
}) => {
  await page.goto("/connections");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fconnections$/);
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
});
