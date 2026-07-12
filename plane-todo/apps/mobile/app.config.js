// Extends the static app.json to inject the EAS projectId from the environment,
// so it isn't committed to source. Get yours by running `eas init` (it can set
// EAS_PROJECT_ID), or add EAS_PROJECT_ID to apps/mobile/.env. A projectId is
// required for push notifications (incl. Expo Go on iOS).
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        ...(config.extra && config.extra.eas),
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
