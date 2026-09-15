# PayGauge

**See what's left.**

PayGauge is a private personal payment tracker focused on loans, recurring bills, payment history, and remaining-payment counts. The app is designed mobile-first for Android and does not connect to bank accounts.

## Initial product goals

- Track loans such as an engagement ring, vehicle, furniture, or other financed purchases.
- Show remaining balance, payments made, and payments left.
- Record manual payments quickly.
- Track recurring bills and autopay schedules.
- Send Android reminders for due dates, scheduled autopay, and payment confirmation.
- Show payoff progress and milestones.
- Work well as an Android app while retaining a web-based codebase.

## Repository layout

- `apps/paygauge-web` — Next.js UI and Capacitor host for Android.
- `apps/api` — optional FastAPI development/reference backend; Android runtime is local-first.
- `packages/types` — shared TypeScript types.
- `packages/ui` — shared UI primitives and PayGauge design tokens.
- `packages/config` — shared application configuration/helpers.
- `database` — database migrations and seed data.
- `docs` — product, architecture, data, and notification documentation.
- `scripts` — development and maintenance scripts.

## Development order

1. Database schema and API models.
2. Loan CRUD and payment recording.
3. Mobile dashboard and loan detail screens.
4. Bills and recurring payment logic.
5. Android packaging with Capacitor.
6. Local Android notifications and confirmation actions.
7. Calendar, milestones, export, and polish.

## Running on Android with Capacitor

PayGauge is local-first on Android. Production Capacitor builds package the complete static Next.js app into the APK and store app data locally on the device. The normal Android app does not require the Next.js dev server, FastAPI, PostgreSQL, or the development PC.

To sync a production Android project with bundled app assets:

```powershell
npm run build:android
```

This builds `apps/paygauge-web/out` and syncs those bundled files into the Android project. Do not set `CAPACITOR_SERVER_URL` for production builds.

For local live-reload phone testing, your computer and phone must be on the same Wi-Fi network. The phone app can load the Next.js dev server from your computer's LAN IP, but normal app data is still stored locally by the Capacitor application.

From the repository root:

```powershell
npm run dev:phone
```

This starts FastAPI on `0.0.0.0:8000` for optional legacy/API testing, starts Next.js on `0.0.0.0:3000`, syncs Capacitor Android with the LAN dev-server URL, and opens Android Studio.

If the detected IP is wrong, pass it explicitly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-phone.ps1 -HostIp 192.168.1.25
```

Android native builds require Android Studio and a JDK. If Gradle reports `JAVA_HOME is not set`, install Android Studio/JDK or set `JAVA_HOME` before building.

## Branding

The approved PayGauge mockup logo assets are stored in `apps/paygauge-web/public/brand/`. Do not substitute or redraw them without approval.
