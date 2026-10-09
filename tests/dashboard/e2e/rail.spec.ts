import { expect, test, type Page } from "@playwright/test";

import { logIn } from "../../helpers/log-in";
import { waitForAccountRow } from "../../helpers/wait-for-account-row";

const rail = (page: Page) => page.locator("[data-slot=sidebar-container]:visible");
const drawer = (page: Page) => page.locator("[data-slot=sidebar][data-mobile=true]");
const toggle = (page: Page) => page.locator("button[data-sidebar=trigger]:visible");
const sections = (page: Page) => page.getByRole("navigation", { name: "Sections" });

// `w-60` is what ui-context.md documents for the rail, and 3rem is the icon width the
// collapsed rail is designed around.
const EXPANDED = "240px";
const ICONS = "48px";

/**
 * Keyboard rather than pointer: the dev toolbar mounts a `nextjs-portal` in the
 * bottom-left corner — exactly where the rail's own trigger sits — and intermittently
 * intercepts the click (`… intercepts pointer events`), which is a dev artifact and not
 * a layout bug. The trigger is a native `<button>`, so Enter reaches it either way, and
 * this also proves the collapse is keyboard operable.
 */
async function pressToggle(page: Page) {
  await toggle(page).focus();
  await page.keyboard.press("Enter");
}

test.describe("@auth app shell rail", () => {
  test.beforeEach(async ({ page }) => {
    await logIn(page);
    // Every test here clicks the rail's trigger, and a pre-hydration click is swallowed:
    // the shell is prerendered, so the button exists long before it does anything.
    await waitForAccountRow(page);
  });

  test("renders its destinations with the active one marked", async ({ page }) => {
    const nav = sections(page).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Connections" })).toBeVisible();
    // /profile is reachable, guarded, and rendered by the shell — it is simply not a
    // rail row any more, because the account block below already offers Profile.
    await expect(nav.getByRole("link", { name: "Profile" })).toHaveCount(0);
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
    const nav = sections(page).first();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the trigger collapses the rail to icons and back", async ({ page }) => {
    await expect(rail(page)).toHaveCSS("width", EXPANDED);

    await pressToggle(page);
    await expect(rail(page)).toHaveCSS("width", ICONS);
    // The labels are clipped by the 2rem button, so the icons are the only text left.
    await expect(rail(page).getByText("Connections")).not.toBeVisible();

    await pressToggle(page);
    await expect(rail(page)).toHaveCSS("width", EXPANDED);
    await expect(rail(page).getByText("Connections")).toBeVisible();
  });

  test("the collapsed rail stays collapsed across a reload", async ({ page }) => {
    await pressToggle(page);
    await expect(rail(page)).toHaveCSS("width", ICONS);

    await page.reload();
    // localStorage is replayed after hydration, so the prerendered shell starts
    // expanded; this is the frame the user does not see.
    await expect(rail(page)).toHaveCSS("width", ICONS);
  });

  test("below the rail breakpoint the destinations live in a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-slot=sidebar-container]")).toHaveCount(0);

    await pressToggle(page);
    const nav = drawer(page).getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("link", { name: "Connections" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("link", { name: "Connections" }).click();
    await expect(page).toHaveURL(/\/connections$/);
    await expect(drawer(page)).toBeHidden();
  });

  test("the rail reserves no horizontal scroll at phone widths", async ({ page }) => {
    for (const width of [320, 390, 414]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/dashboard");
      // The headline only exists in the loaded page — the Suspense fallback renders
      // blocks — so measuring before it would score the skeleton.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${width}px scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});
