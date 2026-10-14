import { Capacitor } from '@capacitor/core';
import OneSignal, {
  type NotificationClickEvent,
} from '@onesignal/capacitor-plugin';
import { SallaPush } from '@salla.sa/sallapush-capacitor';
import { chat, routeOneSignal } from './standIns';

// README "Migrating from OneSignal": OneSignal's listeners and the opt-in switch while both SDKs are in the app.

export function listenWithBothSdks(): void {
  // snippet:onesignal-click
  OneSignal.Notifications.addEventListener(
    'click',
    async ({ notification }: NotificationClickEvent) => {
      if (Capacitor.getPlatform() === 'android') {
        // SallaPush never sees the taps on notifications OneSignal shows: record them, keep routing them.
        await SallaPush.Notifications.trackOpened({
          ...notification.additionalData,
        });
      } else if (
        await SallaPush.Notifications.isSallaPushNotification({
          ...notification.rawPayload,
        })
      ) {
        return; // iOS: SallaPush's click listener routes it.
      }
      routeOneSignal(notification);
    }
  );
  // end-snippet

  // snippet:onesignal-foreground
  // One synchronous policy for both SDKs. SallaPush's listener is Android only: on iOS it would make each compatible
  // notification SallaPush's local copy.
  const foregroundPolicy = (event: { preventDefault(): void }) => {
    if (chat.isOpen()) {
      event.preventDefault();
    }
  };
  OneSignal.Notifications.addEventListener(
    'foregroundWillDisplay',
    foregroundPolicy
  );
  if (Capacitor.getPlatform() === 'android') {
    SallaPush.Notifications.addEventListener(
      'foregroundWillDisplay',
      foregroundPolicy
    );
  }
  // end-snippet
}

export async function pushToggleChanged(isOn: boolean): Promise<void> {
  // snippet:onesignal-opt-in
  if (isOn) {
    // Each SDK's optIn() asks for the permission while it is missing: ask once, then opt both in.
    if (await SallaPush.Notifications.requestPermission(true)) {
      OneSignal.User.pushSubscription.optIn();
      SallaPush.User.pushSubscription.optIn();
    }
  } else {
    OneSignal.User.pushSubscription.optOut();
    SallaPush.User.pushSubscription.optOut();
  }
  // end-snippet
}
