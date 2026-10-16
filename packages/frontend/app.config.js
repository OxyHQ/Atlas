// Dynamic Expo config. A development build can sit next to the production app on
// the same device via APP_VARIANT=development (distinct id + name).
const IS_DEV = process.env.APP_VARIANT === 'development';

const APP_ID = IS_DEV ? 'so.oxy.atlas.dev' : 'so.oxy.atlas';
const APP_NAME = IS_DEV ? 'Atlas (Dev)' : 'Atlas';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'atlas',
    scheme: 'atlas',
    version: '0.1.0',
    orientation: 'portrait',
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
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          dark: { backgroundColor: '#000000' },
        },
      ],
      // Dictation and voice calls with Alia (`@alia.onl/sdk`) recognise speech on
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
      // defaults, and withOxySharedPermissions (Atlas runs on its own Android
      // UID and reaches the Commons/Accounts providers over signature IPC).
      ['@oxy.so/app-preset', {}],
      // Release-signs with the ONE Oxy ecosystem key (OXY_UPLOAD_* Gradle
      // properties) and swaps in the optimising ProGuard file. The preset above
      // does not apply it, and without it a local release build is debug-signed,
      // which Commons' signature-level permissions refuse. Falls back to debug
      // signing when the properties are absent, so verify the shipped
      // certificate (`apksigner verify --print-certs`).
      '@oxy.so/app-preset/plugin/withOxyAndroidRelease',
    ],
    extra: {
      router: {},
    },
  },
};
