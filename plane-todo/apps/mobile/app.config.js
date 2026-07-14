// Extends the static app.json to inject secrets/paths from the environment so
// they aren't committed to source.
//
//  - EAS_PROJECT_ID:  your Expo project id UUID (see expo.dev → your project →
//                     Settings, or run `eas init` to create/link one).
//  - EAS_OWNER:       Expo account/organization slug that owns the project
//                     (e.g. your username). Required by EAS at build time.
//  - GOOGLE_SERVICES_JSON: path to your Firebase google-services.json used for
//                     Android FCM push. Defaults to ./google-services.json.
//                     Only attached when the file actually exists, so
//                     `expo start` in Expo Go still works without it.
//
// NOTE: the FCM V1 *service account key* is NOT referenced here — it is
// uploaded to Expo via `eas credentials` and never bundled in the app. See
// ./credentials/README.md.
const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;
  const owner = process.env.EAS_OWNER;

  const googleServicesPath = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";
  const googleServicesAbs = path.resolve(__dirname, googleServicesPath);
  const hasGoogleServices = fs.existsSync(googleServicesAbs);

  return {
    ...config,
    ...(owner ? { owner } : {}),
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: googleServicesPath } : {}),
    },
    extra: {
      ...config.extra,
      eas: {
        ...(config.extra && config.extra.eas),
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
