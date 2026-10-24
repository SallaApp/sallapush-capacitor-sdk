import {
  SallaPush,
  type SallaPushEventSubscription,
} from '@salla.sa/sallapush-capacitor';
import { settingsScreen } from './standIns';

// The README's "Quick start" and "Foreground notifications": the permission, and a screen that decides about foreground
// notifications.

export async function askForPermission(): Promise<void> {
  // snippet:request-permission
  const granted = await SallaPush.Notifications.requestPermission(true);
  // end-snippet
  settingsScreen.showPermission(granted);
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
