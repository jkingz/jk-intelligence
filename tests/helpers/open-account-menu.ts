import { expect, type Page } from "@playwright/test";

import { waitForAccountRow } from "./wait-for-account-row";

/**
 * Opens the rail's account block and returns its menu. Desktop only: below the rail
 * breakpoint the same row sits inside the drawer, which has to be opened first.
 */
export async function openAccountMenu(page: Page) {
  // The skeleton row has no menu attached, so clicking it would test nothing.
  await waitForAccountRow(page);
  await page
    .locator("[data-slot=sidebar-footer] [data-sidebar=menu-button]")
    .click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}
