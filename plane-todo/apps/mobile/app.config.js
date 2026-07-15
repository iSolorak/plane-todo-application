// Extends the static app.json.
//
// Why this exists: `android.googleServicesFile` must NOT be set when the file
// isn't on disk (e.g. someone just cloned the repo and is running `expo start`
// in Expo Go without FCM). Setting it unconditionally breaks prebuild with a
// "file not found" error. Attaching it conditionally keeps the DX friendly.
//
// Historical note: projectId and owner used to be env-driven here for
// sanitization. That fought EAS Build (which excludes `.env` from uploads on
// purpose) and produced repeated "Invalid UUID appId" / config-mismatch
// failures. They are inherently public identifiers (visible in every build
// URL and OTA update), so they now live statically in app.json.
//
// The FCM V1 *service account key* is NOT referenced here — it is uploaded
// to Expo via `eas credentials` and never bundled in the app. See
// ./credentials/README.md.
const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const googleServicesPath = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
  const googleServicesAbs = path.resolve(__dirname, googleServicesPath);
  const hasGoogleServices = fs.existsSync(googleServicesAbs);

  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: googleServicesPath } : {}),
    },
  };
};
