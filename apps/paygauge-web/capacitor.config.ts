import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.paygauge.mobile',
  appName: 'PayGauge',
  webDir: 'out',
  server: process.env.CAPACITOR_SERVER_URL
    ? {
        url: process.env.CAPACITOR_SERVER_URL,
        cleartext: true,
      }
    : undefined,
  plugins: {
    StatusBar: {
      backgroundColor: '#07111d',
      style: 'DARK',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#07111d',
      showSpinner: false,
    },
  },
};

export default config;
