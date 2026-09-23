import { expect, test } from "@playwright/test";
import { logIn } from "../../helpers/log-in";

test("@auth the dashboard renders a real metric", async ({ page }) => {
  await logIn(page);
  const metrics = page.getByRole("region", { name: "Performance metrics" });
  await expect(metrics).toBeVisible();
  await expect(metrics).toContainText(/Total Clicks \(\d+d\)/);
  await expect(metrics).toContainText("Impressions");
});
