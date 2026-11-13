# Tally Branding

Approved name: **Tally** (formerly PayGauge)

Tagline: **See what's left.**

## Logo

A progress ring in the mazzagotte.dev mark square: a black rounded square (white in dark mode) with a ring that is about 72% filled with a blue-to-violet gradient (#3B82F6 → #8B5CF6), showing what's left.

- Master SVG: `apps/paygauge-web/public/tally-logo.svg`; 1024px PNG: `docs/design/tally-logo-1024.png`
- In-app mark: `src/components/navigation/TallyMark.tsx`
- Android adaptive icon: solid #09090B background, ring foreground, white monochrome layer (themed icons)
- Previous PayGauge icons are archived in `docs/design/paygauge-icons/`

## Visual style

Matches the mazzagotte.dev hub: zinc neutrals, Geist and Geist Mono (bundled in `public/fonts`), and a #2563EB blue accent. Light mode is the default, and dark mode follows the phone setting.

## Unchanged internal identifiers

To keep existing installs and backups working, these still say "paygauge": the Android app ID `app.paygauge.mobile`, the local storage/SQLite keys, the notification channel ID, the backup file's `app` field, and the repo/folder names.
