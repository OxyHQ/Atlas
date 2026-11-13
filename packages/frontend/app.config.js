// Dynamic Expo config. A development build can sit next to the production app on
// the same device via APP_VARIANT=development (distinct id + name).
const IS_DEV = process.env.APP_VARIANT === 'development';

const APP_ID = IS_DEV ? 'so.oxy.atlas.dev' : 'so.oxy.atlas';
const APP_NAME = IS_DEV ? 'Atlas (Dev)' : 'Atlas';

// Atlas's public Oxy client id, the same value `lib/config.ts` hands the
// OxyProvider; Oxy Updates serves the OTA manifest by it.
const OXY_CLIENT_ID =
  process.env.EXPO_PUBLIC_OXY_CLIENT_ID ||
  'oxy_dk_b1440fd0ad132ffe6279f47d1d769bed92e6cfeb7dc4a7e1';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'atlas',
    scheme: 'atlas',
    version: '0.2.0',
    orientation: 'portrait',
    icon: './assets/images/atlas-icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: APP_ID,
    },
    android: {
      package: APP_ID,
      adaptiveIcon: {
        foregroundImage: './assets/images/atlas-icon_foreground.png',
        backgroundImage: './assets/images/atlas-icon_background.png',
        monochromeImage: './assets/images/atlas-icon_monochrome.png',
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './public/favicon.ico',
    },
    plugins: [
      // SDK 58 splits web routes into lazy chunks by default; Atlas keeps the
      // single synchronous bundle it shipped on SDK 57.
      ['expo-router', { asyncRoutes: { web: false } }],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          dark: { backgroundColor: '#000000' },
        },
      ],
      // Dictation and voice calls with Alia (`@gemies/sdk`) recognise speech on
      // the device; the plugin writes the two iOS purpose strings and the
      // Android RECORD_AUDIO permission.
      [
        'react-native-audio-api',
        {
          iosMicrophonePermission: 'Allow Atlas to hear what you dictate and say to Alia.',
          iosBackgroundMode: false,
          androidForegroundService: false,
          androidPermissions: ['android.permission.RECORD_AUDIO'],
        },
      ],
      // Shared Oxy native config: the iOS keychain group, expo-build-properties
      // defaults, the R8 -optimize ProGuard file, and withOxySharedPermissions
      // (Atlas runs on its own Android UID and reaches the Commons/Accounts
      // providers over signature IPC), which also release-signs with the ONE
      // Oxy ecosystem key and fails a release build that is not signed with it.
      ['@oxy.so/app-preset', {}],
      // OTA updates from Oxy Updates (oxy-api), published on every push to main
      // by `.github/workflows/publish-update.yml`, signed with the ecosystem
      // certificate. The runtime is `version` (appVersion policy): bump it for
      // a native change, which is also what releases a new binary
      // (`.github/workflows/android-release.yml`). The preset derives
      // android.versionCode / ios.buildNumber from `version`; never set them.
      ['@oxy.so/app-preset/plugin/withOxyUpdates', { clientId: OXY_CLIENT_ID }],
    ],
    extra: {
      router: {},
    },
  },
};
