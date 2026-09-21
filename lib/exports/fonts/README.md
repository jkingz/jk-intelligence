# Report fonts

`NotoSans-Regular.ttf` / `NotoSans-Bold.ttf` from the Noto project
(https://github.com/notofonts/noto-fonts, `hinted/ttf/NotoSans/`), licensed under the
SIL Open Font License 1.1.

pdf-lib embeds them via `@pdf-lib/fontkit` with subsetting on, so only the glyphs a
report actually uses are written into the PDF. Needed because the PDF's client name,
domain and keywords are user data — the standard-14 fonts are WinAnsi-only and cannot
render non-Latin scripts or Central/Eastern European diacritics.

Known limit: no CJK-mono-spaced fallback beyond Noto Sans's own coverage, and glyphs the
font lacks are replaced (see `lib/exports/pdf.ts` → `reportText`).
