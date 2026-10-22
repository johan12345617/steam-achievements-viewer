import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: process.env.APP_NAME || 'Steam Achievements',
  slug: 'steam-achievements-mobile',
  version: process.env.APP_VERSION || '1.0.0',
  scheme: 'steamachievements',
  orientation: 'default',
  userInterfaceStyle: 'dark',
  android: {
    package: process.env.ANDROID_PACKAGE || 'com.steamachievements.viewer',
    versionCode: Number(process.env.ANDROID_VERSION_CODE || '1'),
    permissions: [],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER || 'com.steamachievements.viewer',
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  plugins: [
    'expo-font',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-image-picker', {
      photosPermission: 'Choose screenshots or clips to attach to your achievements.',
      cameraPermission: false,
      microphonePermission: false,
    }],
    'expo-video',
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.ALLOW_LOCAL_HTTP === 'true' } }],
  ],
  extra: {
    apiBase: process.env.EXPO_PUBLIC_API_URL || 'https://steam-achievements-viewer.onrender.com/api',
  },
};

export default config;
