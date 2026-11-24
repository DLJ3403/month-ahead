# Month Ahead — maintainer notes

Month Ahead is a private, offline-first personal finance tracker (installable PWA).
It is plain HTML/CSS/JS at the root of this repo (no build step, no dependencies)
and is published to GitHub Pages by `.github/workflows/pages.yml`.

## Privacy rules (do not break)
- No network calls at runtime other than loading the app's own files. The CSP in
  `index.html` enforces `connect-src 'self'`; keep it.
- No analytics, fonts, CDNs, or AI calls. Insights are rule-based in `js/calc.js`.
- User data lives only in IndexedDB (`month-ahead` DB, `kv` store, key `state`),
  with localStorage as a fallback.

## Data model (schema v2)
- `incomes[]`: household take-home sources, each `{ name, amount, freq, count, reliable }`.
  `freq` is weekly / biweekly / semimonthly / monthly / perYear; `count` is payments a year for perYear.
- `plan`: `{ savingsMonthly, weeklySpending }`.
- `checkins[].extraIncome`: irregular money that arrived that week (e.g. a class payment).
- Surplus months, spending trend, debt paydown and highlights are all derived in `js/calc.js`.

## Files
- `js/calc.js`  pure calculations (net worth, buffer, streaks, XP, badges, insights, summary text)
- `js/store.js` storage, schema version + migrations, backup import/export
- `js/app.js`   UI, routing (`#home`, `#checkin`, `#checkin/monthly`, `#bills`, `#growth`, `#data`, `#setup`)
- `sw.js`       offline cache + update flow

## Shipping an update
1. Change the code.
2. Bump `CACHE_VERSION` in `sw.js` (and `APP_VERSION` in `js/app.js`).
   Phones then show "A new version of Month Ahead is ready. Update now".
   Updating never touches saved data.
3. If the saved data shape changes, bump `SCHEMA_VERSION` in `js/store.js` and add a
   migration `MIGRATIONS[oldVersion] = (d) => ({ ...d, schemaVersion: oldVersion + 1 })`.
   Old backups are migrated on restore the same way.
4. If you add a file, add it to `ASSETS` in `sw.js`.

## Feedback loop with Claude
The app never calls an AI service. The user taps "Copy summary for Claude" and pastes the
text into a chat. Use that summary to give feedback, and to decide on app changes.
