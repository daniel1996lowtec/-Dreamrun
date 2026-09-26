import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dreamrun.game',
  appName: 'DREAM RUN',
  webDir: 'dist',
  backgroundColor: '#05060f',
  android: {
    backgroundColor: '#05060f',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Keep the WebView at 60fps — hardware acceleration is on by default,
    // these flags make the game feel native.
    appendUserAgent: 'DreamRun/1.0',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: false,
      backgroundColor: '#05060f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#05060f',
      overlaysWebView: true,
    },
  },
};

export default config;
