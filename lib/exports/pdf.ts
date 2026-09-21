import { readFile } from "node:fs/promises";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

import type { ExportDataset } from "@/types/exports";

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const ROW_HEIGHT = 16;
const MAX_KEYWORD_ROWS = 25;

const ink = rgb(0.09, 0.09, 0.09);
const muted = rgb(0.4, 0.4, 0.4);
const faint = rgb(0.62, 0.62, 0.62);
const accent = rgb(0.9, 0.32, 0.1);
const hairline = rgb(0.85, 0.85, 0.85);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Vendored Unicode TTFs (see `fonts/README.md`) — standard fonts are WinAnsi-only. */
const FONT_PATHS = {
  regular: "lib/exports/fonts/NotoSans-Regular.ttf",
  bold: "lib/exports/fonts/NotoSans-Bold.ttf",
};

interface FontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

let fontBytes: FontBytes | null = null;

async function loadFontBytes(): Promise<FontBytes> {
  if (!fontBytes) {
    const [regular, bold] = await Promise.all([
      readFile(FONT_PATHS.regular),
      readFile(FONT_PATHS.bold),
    ]);
    fontBytes = { regular, bold };
  }
  return fontBytes;
}

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const bytes = await loadFontBytes();
  const [regular, bold] = await Promise.all([
    doc.embedFont(bytes.regular, { subset: true }),
    doc.embedFont(bytes.bold, { subset: true }),
  ]);
  return { regular, bold };
}

/**
 * Control characters have no glyph in any font, so they become spaces.
 * Everything else — accents, Cyrillic, CJK, symbols — is passed through for the
 * embedded Unicode font to render (glyphs Noto Sans lacks draw as blanks).
 */
export function reportText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
}

function clip(value: string, font: PDFFont, maxWidth: number): string {
  let candidate = reportText(value);
  if (font.widthOfTextAtSize(candidate, 9) <= maxWidth) return candidate;
  while (candidate.length > 1 && font.widthOfTextAtSize(`${candidate}…`, 9) > maxWidth) {
    candidate = candidate.slice(0, -1);
  }
  return `${candidate}...`;
}

function number(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("en-US");
}

function drawRow(
  page: ReturnType<PDFDocument["addPage"]>,
  fonts: Fonts,
  columns: Array<{ x: number; value: string; bold?: boolean; muted?: boolean; max?: number }>,
  y: number,
): void {
  for (const column of columns) {
    const font = column.bold ? fonts.bold : fonts.regular;
    const value = column.max ? clip(column.value, font, column.max) : reportText(column.value);
    page.drawText(value, {
      x: column.x,
      y,
      size: 9,
      font,
      color: column.muted ? muted : ink,
    });
  }
}

function sectionTitle(
  page: ReturnType<PDFDocument["addPage"]>,
  fonts: Fonts,
  title: string,
  y: number,
): number {
  page.drawRectangle({
    x: MARGIN,
    y: y + 1,
    width: 3,
    height: 12,
    color: accent,
  });
  page.drawText(reportText(title.toUpperCase()), {
    x: MARGIN + 9,
    y: y + 3,
    size: 10,
    font: fonts.bold,
    color: ink,
  });
  return y - 14;
}

const KEYWORD_COLUMNS = [
  { x: MARGIN, max: 190 },
  { x: MARGIN + 200 },
  { x: MARGIN + 260 },
  { x: MARGIN + 340 },
  { x: MARGIN + 430 },
];

const SOURCE_COLUMNS = [
  { x: MARGIN, max: 110 },
  { x: MARGIN + 120 },
  { x: MARGIN + 200 },
  { x: MARGIN + 290 },
  { x: MARGIN + 380 },
];

export async function renderPdfReport(dataset: ExportDataset): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const { regular, bold } = fonts;
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensure = (needed: number) => {
    if (y >= needed) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  page.drawText(reportText(dataset.client.name.toUpperCase()), {
    x: MARGIN,
    y: y - 13,
    size: 18,
    font: bold,
    color: ink,
  });
  y -= 26;
  page.drawText(reportText(`SEO Performance Report · ${dataset.client.domain}`), {
    x: MARGIN,
    y,
    size: 10,
    font: regular,
    color: muted,
  });
  y -= 15;
  page.drawText(
    reportText(`Range: ${dataset.range.label} (${dataset.days} days) · Generated: ${dataset.generatedAt}`),
    { x: MARGIN, y, size: 9, font: regular, color: muted },
  );
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y: y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 1,
    color: hairline,
  });
  y -= 28;

  y = sectionTitle(page, fonts, "Summary", y);
  for (const row of dataset.summary) {
    ensure(MARGIN + 40);
    drawRow(
      page,
      fonts,
      [
        { x: MARGIN, value: row.label, muted: true, max: 190 },
        { x: MARGIN + 210, value: row.value, bold: true },
        ...(row.delta ? [{ x: MARGIN + 350, value: row.delta, muted: true }] : []),
      ],
      y,
    );
    y -= ROW_HEIGHT;
  }
  y -= 10;

  y = sectionTitle(page, fonts, "Top Keywords", y);
  ensure(MARGIN + 60);
  drawRow(
    page,
    fonts,
    [
      { x: KEYWORD_COLUMNS[0].x, value: "Keyword", bold: true },
      { x: KEYWORD_COLUMNS[1].x, value: "Rank", bold: true },
      { x: KEYWORD_COLUMNS[2].x, value: "Change", bold: true },
      { x: KEYWORD_COLUMNS[3].x, value: "Volume", bold: true },
      { x: KEYWORD_COLUMNS[4].x, value: "Clicks", bold: true },
    ],
    y,
  );
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: hairline,
  });
  y -= 12;
  for (const keyword of dataset.keywords.slice(0, MAX_KEYWORD_ROWS)) {
    ensure(MARGIN + 40);
    drawRow(
      page,
      fonts,
      [
        { x: KEYWORD_COLUMNS[0].x, value: keyword.keyword, max: KEYWORD_COLUMNS[0].max },
        { x: KEYWORD_COLUMNS[1].x, value: String(keyword.rank) },
        {
          x: KEYWORD_COLUMNS[2].x,
          value: keyword.change === null ? "-" : `${keyword.change > 0 ? "+" : ""}${keyword.change}`,
        },
        { x: KEYWORD_COLUMNS[3].x, value: number(keyword.volume) },
        { x: KEYWORD_COLUMNS[4].x, value: number(keyword.clicks) },
      ],
      y,
    );
    y -= ROW_HEIGHT;
  }
  y -= 10;

  y = sectionTitle(page, fonts, "Source Totals", y);
  ensure(MARGIN + 60);
  drawRow(
    page,
    fonts,
    [
      { x: SOURCE_COLUMNS[0].x, value: "Source", bold: true },
      { x: SOURCE_COLUMNS[1].x, value: "Records", bold: true },
      { x: SOURCE_COLUMNS[2].x, value: "Clicks", bold: true },
      { x: SOURCE_COLUMNS[3].x, value: "Impressions", bold: true },
      { x: SOURCE_COLUMNS[4].x, value: "Conversions", bold: true },
    ],
    y,
  );
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_WIDTH, y },
    thickness: 0.5,
    color: hairline,
  });
  y -= 12;
  for (const total of dataset.sourceTotals) {
    ensure(MARGIN + 40);
    drawRow(
      page,
      fonts,
      [
        { x: SOURCE_COLUMNS[0].x, value: total.source },
        { x: SOURCE_COLUMNS[1].x, value: number(total.records) },
        { x: SOURCE_COLUMNS[2].x, value: number(total.clicks) },
        { x: SOURCE_COLUMNS[3].x, value: number(total.impressions) },
        { x: SOURCE_COLUMNS[4].x, value: number(total.conversions) },
      ],
      y,
    );
    y -= ROW_HEIGHT;
  }

  page.drawText(reportText(`Generated by JK Intelligence · ${dataset.generatedAt}`), {
    x: MARGIN,
    y: MARGIN - 12,
    size: 8,
    font: regular,
    color: faint,
  });

  return doc.save();
}
