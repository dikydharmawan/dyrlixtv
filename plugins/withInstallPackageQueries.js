const { withAndroidManifest } = require('expo/config-plugins');

const INSTALL_INTENT = {
  action: [
    { $: { 'android:name': 'android.intent.action.VIEW' } },
    { $: { 'android:name': 'android.intent.action.INSTALL_PACKAGE' } },
  ],
  data: [{ $: { 'android:mimeType': 'application/vnd.android.package-archive' } }],
};

function hasInstallIntent(queries) {
  return (queries?.intent ?? []).some((intent) =>
    (intent.action ?? []).some(
      (a) => a?.$?.['android:name'] === 'android.intent.action.INSTALL_PACKAGE',
    ),
  );
}

module.exports = function withInstallPackageQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [];
    }
    if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }
    const queries = manifest.queries[0];
    if (!queries.intent) {
      queries.intent = [];
    }
    if (!hasInstallIntent(queries)) {
      queries.intent.push(INSTALL_INTENT);
    }
    return config;
  });
};
