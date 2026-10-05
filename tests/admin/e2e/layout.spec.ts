import { expect, test } from "@playwright/test";

import { logIn } from "../../helpers/log-in";

for (const viewport of [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`@auth /admin at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("the tables clip inside their own boxes, not the document", async ({ page }) => {
      await logIn(page, "admin");
      await page.goto("/admin");
      // The panel's read is cookie-bound, so the rows arrive with the document — but
      // wait for a landmark rather than a race against the first paint.
      await expect(page.getByRole("table").first()).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
    });

    test("the rail renders with nothing marked active", async ({ page }) => {
      await logIn(page, "admin");
      await page.goto("/admin");
      // Both Sections landmarks stay in the DOM; `:visible` is what separates the
      // rail from the below-lg strip, so the count is of landmarks, not links.
      const sections = page.locator("nav[aria-label='Sections']:visible");
      await expect(sections).toHaveCount(1);
      await expect(
        sections.getByRole("link", { name: "Dashboard" }),
      ).toBeVisible();
      // activeDestination("/admin") is null: no href claims it, so no link carries
      // the active state. That is the point, and why Task 8 added no destination row.
      await expect(sections.locator("[aria-current]")).toHaveCount(0);
    });
  });
}
