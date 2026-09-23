import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { logIn } from "../../helpers/log-in";
import { CSV_HEADERS } from "@/lib/exports/csv";

test("@auth the CSV export downloads with the expected header row", async ({ page }) => {
  await logIn(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export data" }).click();
  await page.getByRole("menuitem", { name: "Download CSV" }).click();

  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);

  const body = await readFile(await file.path(), "utf8");
  // buildCsv emits a UTF-8 BOM and CRLF endings on purpose (lib/exports/csv.ts:68)
  // so Excel executes the file instead of mojibake-ing it. Assert both, then the
  // header against the single source of truth.
  const BOM = "\uFEFF";
  expect(body.startsWith(BOM)).toBe(true);
  const [header, ...rows] = body.trimEnd().split("\r\n");
  expect(header).toBe(`${BOM}${CSV_HEADERS.join(",")}`);
  expect(rows.length).toBeGreaterThan(0);
});
