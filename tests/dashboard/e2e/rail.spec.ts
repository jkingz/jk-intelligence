import { expect, test } from "@playwright/test";

import { logIn } from "../../helpers/log-in";

test.describe("@auth app shell rail", () => {
  test.beforeEach(async ({ page }) => {
    await logIn(page);
  });

  test("renders the three destinations with the active one marked", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Sections" }).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Connections" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the rail reserves no horizontal scroll at phone widths", async ({ page }) => {
    for (const width of [320, 390, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dashboard");
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    }
  });
});
