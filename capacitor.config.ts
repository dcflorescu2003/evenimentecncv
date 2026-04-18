import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT pentru build de producție (App Store / Play Store):
// NU adăuga `server.url` aici — Apple respinge build-urile care încarcă
// conținut dintr-un URL extern. Pentru hot-reload în dezvoltare folosește
// un fișier separat (ex: capacitor.config.dev.ts).
const config: CapacitorConfig = {
  appId: 'com.evenimentecncv.app',
  appName: 'Evenimente',
  webDir: 'dist'
};

export default config;
