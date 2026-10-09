import { expect, type Page } from "@playwright/test";

/**
 * The rail is a client island inside a prerendered page, so its trigger accepts a click
 * only once React has hydrated — and `logIn()` returns as soon as the URL settles, which
 * on a cold dev compile is well before that. The account row is the witness: its
 * `aria-haspopup` appears when `/api/auth/me` answers, which cannot happen pre-hydration.
 * Desktop only; below the rail breakpoint the row lives in a closed drawer and is absent.
 */
export async function waitForAccountRow(page: Page) {
  await expect(
    page.locator("[data-slot=sidebar-footer] [data-sidebar=menu-button]"),
  ).toHaveAttribute("aria-haspopup", "menu", { timeout: 15_000 });
}
