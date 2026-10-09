import { expect, test, type Page } from "@playwright/test";

import { logIn } from "../../helpers/log-in";
import { openAccountMenu } from "../../helpers/open-account-menu";

// The invariant here is identity, not layout: the account block is the only place a
// signed-in user confirms who they are and leaves the session. The rail that carries it
// belongs to tests/dashboard/e2e/rail.spec.ts.
//
// @auth is read-only, so this reads the menu and never presses Log out.

const row = (page: Page) =>
  page.locator("[data-slot=sidebar-footer] [data-sidebar=menu-button]");

test("@auth the rail names the signed-in account and its role", async ({ page }) => {
  await logIn(page);
  // The row renders a skeleton first, so the email is the load signal.
  await expect(row(page)).toContainText(process.env.DEMO_EMAIL!, { timeout: 15_000 });
  // Role sits below the email. CSS renders it upper-case; the DOM keeps the stored
  // value, which is one of `admin | client | staff`.
  await expect(row(page)).toContainText("client");
});

test("@auth the account menu offers Profile and Log out", async ({ page }) => {
  await logIn(page);
  const menu = await openAccountMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Log out" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
