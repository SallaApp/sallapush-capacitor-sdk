import {
  SallaPush,
  type SallaPushEventSubscription,
} from '@salla.sa/sallapush-capacitor';
import { settingsScreen } from './standIns';

// The README's "Quick start", "Foreground notifications" and "Badges", and the setup guide: the permission, a screen
// that decides about foreground notifications, and the badge settings.

export async function askForPermission(): Promise<void> {
  // snippet:request-permission
  const granted = await SallaPush.Notifications.requestPermission(true);
  // end-snippet
  settingsScreen.showPermission(granted);
}

export function startClearingTheBadgeOnBothPlatforms(appId: string): void {
  // snippet:badges
  SallaPush.initialize(appId, { autoClearBadge: true });
  // end-snippet
}

// While a chat screen shows its messages, SallaPush doesn't show that chat's notifications. The screen removes the
// listener when it closes.
export function chatScreenOpened(chatId: string): SallaPushEventSubscription {
  // snippet:will-display
  const chatListener = SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event) => {
      if (event.notification.getString('chat_id') === chatId) {
        event.preventDefault(); // before any await: it counts only while the listener runs
      }
    }
  );
  // end-snippet
  return chatListener;
}
