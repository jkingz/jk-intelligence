import { expect, test, type Page } from "@playwright/test";
import { logIn } from "../../helpers/log-in";

const tab = (page: Page, name: string) => page.getByRole("tab", { name });

test("@auth switching section writes and restores ?tab=", async ({ page }) => {
  await logIn(page);
  await expect(page.getByRole("region", { name: "Performance metrics" })).toBeVisible();

  await tab(page, "Queries").click();
  await expect(page).toHaveURL(/tab=queries/);
  await expect(page.getByRole("region", { name: "Performance metrics" })).toBeHidden();

  const deepLink = page.url();
  await page.goto(deepLink);
  await expect(tab(page, "Queries")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Performance metrics" })).toBeHidden();
});
