// Capacitor config — the native wrapper reuses the built web app verbatim (D2/D6 in
// docs/DECISIONS.md). This is additive: the PWA works standalone; Capacitor packages
// it for the app stores and unlocks native GPS/health sensors later.
//
// To produce native projects (when you're ready to ship to stores):
//   pnpm --filter @hitrace/web build
//   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/geolocation
//   npx cap add android      # and/or: npx cap add ios (needs macOS/Xcode)
//   npx cap sync
//   npx cap open android
//
// The webDir points at the Vite build output.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hitrace',
  appName: 'HitRace',
  webDir: 'dist',
  backgroundColor: '#08090B',
  // allowMixedContent: the app is served over https://localhost but talks to a
  // cleartext http API in local dev (emulator 10.0.2.2 / LAN IP). Needed there;
  // in production the API is https and this is irrelevant.
  android: { allowMixedContent: true },
  plugins: {
    // Real cadence/HR needs a health-sensor plugin; GPS uses @capacitor/geolocation.
    Geolocation: { permissions: ['location'] },
  },
};

export default config;
