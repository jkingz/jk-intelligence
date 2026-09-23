import { expect, test, type Page } from "@playwright/test";
import { logIn } from "../../helpers/log-in";

test.use({ viewport: { width: 390, height: 844 } });

const overflow = () =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth;

const picker = (page: Page) => page.getByLabel("Select reporting client");

test("@auth no dashboard section scrolls the page sideways", async ({ page }) => {
  await logIn(page);
  await expect(page.getByRole("region", { name: "Performance metrics" })).toBeVisible();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const section of ["Overview", "Queries", "AI Citation"]) {
      await page.getByRole("tab", { name: section }).click();
      await expect
        .poll(() => page.evaluate(overflow), `${width}px ${section} scrolls the page sideways`)
        .toBeLessThanOrEqual(0);
    }
  }
});

test("@auth client picker never covers a header action", async ({ page }) => {
  await logIn(page);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const edge = (await picker(page).boundingBox()) ?? { x: 0, width: 0 };
    const rightOfPicker = edge.x + edge.width;

    for (const name of ["Export data", "Toggle theme", "Account menu"]) {
      const action = page.getByRole("button", { name });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box, `${name} has no box`).not.toBeNull();
      expect(
        rightOfPicker,
        `${name} sits under the client picker at ${width}px`,
      ).toBeLessThanOrEqual(box!.x);
    }
  }
});
