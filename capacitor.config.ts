import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT pentru build de producție (App Store / Play Store):
// NU adăuga `server.url` aici — Apple respinge build-urile care încarcă
// conținut dintr-un URL extern. Pentru hot-reload în dezvoltare folosește
// un fișier separat (ex: capacitor.config.dev.ts).
const config: CapacitorConfig = {
  appId: 'com.evenimentecncv.app',
  appName: 'CNCV',
  webDir: 'dist',
  plugins: {
    // Android 16 impune edge-to-edge. SystemBars injectează în WebView
    // variabilele --safe-area-inset-* folosite de interfață.
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
  },
};

export default config;
