# Android FCM V1 credentials

Two Firebase artifacts are needed for Android push (see
<https://docs.expo.dev/push-notifications/fcm-credentials/>). **Neither real
file is committed** — only the `*.example.json` templates are tracked.

## 1. FCM V1 service account key — the key you generated

This is uploaded to **Expo**, not bundled into the app.

1. Save your generated key here as:
   ```
   apps/mobile/credentials/google-service-account-key.json
   ```
   (gitignored — see `google-service-account-key.example.json` for the shape).
2. Upload it to your Expo project:
   ```bash
   cd apps/mobile
   eas credentials
   # → Android → (build profile) → Google Service Account
   #   → "Manage your Google Service Account Key for Push Notifications (FCM V1)"
   #   → Upload → select credentials/google-service-account-key.json
   ```
   (Or upload it in the Expo dashboard: your project → Credentials → Android →
   "FCM V1 service account key".)

Expo uses this key to deliver your notifier's push messages to Android via FCM.

## 2. google-services.json — goes in the app

Needed by Android **development / production builds** (not Expo Go) so the app
can register with FCM and obtain a push token.

1. Download it from Firebase console → Project settings → Your apps → Android
   app → `google-services.json`.
2. Save it as `apps/mobile/google-services.json` (gitignored; copy the shape
   from `google-services.example.json`). Its `package_name` must match
   `android.package` in `app.json`.
3. It's wired automatically: `app.config.js` sets `android.googleServicesFile`
   to `./google-services.json` when the file exists (override with the
   `GOOGLE_SERVICES_JSON` env var).

## Reminder

Push notifications do **not** work in Expo Go — build a dev client
(`npx expo run:android` or EAS Build) to test them.
