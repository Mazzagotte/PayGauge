# PayGauge Architecture

## Client

Next.js provides the UI. Capacitor packages the same application as an Android app and provides access to native Android capabilities such as local notifications.

## Backend

FastAPI exposes the application API. PostgreSQL stores loans, bills, payments, reminder settings, and user preferences.

## Initial single-user assumption

PayGauge begins as a private single-user application. Authentication can be deliberately minimal at first, but the data model should still use IDs cleanly so multi-user support can be added later without rewriting core tables.

## No bank synchronization

PayGauge does not connect to a bank. Autopay means "expected to be paid automatically" rather than verified by a bank. The app should request confirmation after an expected autopay date before marking the payment complete.
