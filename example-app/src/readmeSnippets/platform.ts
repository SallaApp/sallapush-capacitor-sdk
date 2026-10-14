import { Capacitor } from '@capacitor/core';
import { SallaPush } from '@salla.sa/sallapush-capacitor';
import { settingsScreen } from './standIns';

// README "Quick start", on the web: SallaPush runs on iOS and Android only, where its requests never reject. In a
// browser they reject, and its other calls print one console error each.

export async function showPushSettings(): Promise<void> {
  // snippet:native-only
  if (Capacitor.isNativePlatform()) {
    settingsScreen.showPermission(
      await SallaPush.Notifications.getPermission()
    );
  } else {
    settingsScreen.hidePushSettings();
  }
  // end-snippet
}
