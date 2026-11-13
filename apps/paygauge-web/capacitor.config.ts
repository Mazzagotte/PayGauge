import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.paygauge.mobile',
  appName: 'Tally',
  webDir: 'out',
  server: process.env.CAPACITOR_SERVER_URL
    ? {
        url: process.env.CAPACITOR_SERVER_URL,
        cleartext: true,
      }
    : undefined,
  plugins: {
    StatusBar: {
      backgroundColor: '#F7F7F8',
      style: 'LIGHT',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#F7F7F8',
      showSpinner: false,
    },
  },
};

export default config;
