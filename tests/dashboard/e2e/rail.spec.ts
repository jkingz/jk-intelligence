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

  test("the active row survives the dashboard's query state", async ({ page }) => {
    // `client=x` is a placeholder, not a real client id: the rail's active state is
    // derived from the pathname alone, so this asserts the path + the attribute and
    // nothing about whether the app accepted the ids.
    await page.goto("/dashboard?client=x&days=90&tab=queries");
    const nav = page.getByRole("navigation", { name: "Sections" }).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("below lg the destination strip is the only Sections landmark", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 840 });
    await page.goto("/profile");
    // Both landmarks are always in the DOM and `:visible` is what tells them apart:
    // the rail is `hidden`, the strip is `flex` (`lg:hidden` / `hidden lg:flex`).
    const sections = page.locator("nav[aria-label='Sections']:visible");
    await expect(sections).toHaveCount(1);
    await expect(sections).toHaveClass(/lg:hidden/);
    await expect(sections.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Connections" })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(sections.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the rail reserves no horizontal scroll at phone widths", async ({ page }) => {
    for (const width of [320, 390, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dashboard");
      // The footer's brand text exists only in the loaded page — the Suspense
      // fallback renders blocks — so measuring before it would score the skeleton.
      await expect(
        page.getByRole("contentinfo").getByText("JK Intelligence"),
      ).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    }
  });
});
