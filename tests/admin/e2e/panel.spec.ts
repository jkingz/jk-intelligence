import { expect, test } from "@playwright/test";

import { logIn } from "../../helpers/log-in";

// @auth is read-only by design: it is the only tier that can see the role gate and
// the phone-width clip, and it writes nothing so no test-created client outlives its run.
test("@auth an admin reaches the provisioning panel", async ({ page }) => {
  await logIn(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Provisioning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach account" })).toBeVisible();
});

test("@auth a client-role account is bounced off /admin", async ({ page }) => {
  await logIn(page, "demo");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Provisioning" })).toHaveCount(0);
});

// One role per test: /auth/login redirects a signed-in visitor, so a second
// logIn() on the same page never reaches the form. Each test gets its own context.
test("@auth the demo menu does not offer Admin", async ({ page }) => {
  await logIn(page, "demo");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
});

test("@auth the admin menu offers Admin, and it reaches the panel", async ({ page }) => {
  await logIn(page, "admin");
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  // The dashboard header owns AccountMenu and `dashboard.tsx`'s EmptyShell branches
  // render no header, so the menu only exists over a client that has metrics. Which
  // ones do is data, not code: ask for the accessible list and take the first load.
  const boot = await page.request.get("/api/dashboard/boot");
  const { clients } = (await boot.json()) as { clients: { id: string }[] };
  for (const client of clients) {
    await page.goto(`/dashboard?client=${client.id}`);
    const loaded = await accountMenu
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!loaded) continue;
    await accountMenu.click();
    const admin = page.getByRole("menuitem", { name: "Admin" });
    await expect(admin).toBeVisible();
    await admin.click();
    await expect(page).toHaveURL(/\/admin$/);
    return;
  }
  throw new Error(
    "No accessible client has synced metrics, so the dashboard never renders its " +
      "header and the panel has no visible entry point from it.",
  );
});
