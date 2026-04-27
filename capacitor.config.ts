import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT pentru build de producție (App Store / Play Store):
// NU adăuga `server.url` aici — Apple respinge build-urile care încarcă
// conținut dintr-un URL extern. Pentru hot-reload în dezvoltare folosește
// un fișier separat (ex: capacitor.config.dev.ts).
const config: CapacitorConfig = {
  appId: 'com.evenimentecncv.app',
  appName: 'Evenimente',
  webDir: 'dist',
  plugins: {
    // Status bar nu se mai suprapune peste WebView pe Android
    // (sistemul rezervă spațiu, conținutul rămâne sub bara de status).
    // Pe iOS, plugin-ul controlează doar stilul (fundalul vine din safe-area CSS).
    StatusBar: {
      overlaysWebView: false,
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
