import { Capacitor } from '@capacitor/core';
// snippet:import
import { SallaPush } from '@salla.sa/sallapush-capacitor';
// end-snippet
import { settingsScreen } from './standIns';

// The README's "Quick start" (the import). SallaPush runs on iOS and Android only, where its requests never reject. In
// a browser they reject, and its other calls print one console error each.

export async function showPushSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    settingsScreen.showPermission(
      await SallaPush.Notifications.getPermission()
    );
  } else {
    settingsScreen.hidePushSettings();
  }
}
