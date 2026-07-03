import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.auralis.app',
  appName: 'Auralis',
  webDir: '.',           // point this at your built web assets folder
  android: {
    allowMixedContent: false
  },
  plugins: {
    BackgroundMode: {
      // Keeps a low-priority notification up while audio plays in the
      // background, which is what stops Android from killing the process.
      // Package: @anuradev/capacitor-background-mode
      // (the older @capacitor-community/background-mode is deprecated)
      notificationTitle: 'Auralis',
      notificationText: 'Playing in background'
    }
  }
};

export default config;
