import {
  SallaPush,
  type SallaPushEventSubscription,
} from '@salla.sa/sallapush-capacitor';
import { settingsScreen } from './standIns';

// README "Notifications": the permission, and a screen that decides about foreground notifications.

export async function askForPermission(): Promise<void> {
  // snippet:request-permission
  const granted = await SallaPush.Notifications.requestPermission(true);
  // end-snippet
  settingsScreen.showPermission(granted);
}

// snippet:will-display
let chatListener: SallaPushEventSubscription | null = null;

// While a chat screen shows its messages, SallaPush doesn't show that chat's notifications.
export function chatScreenOpened(chatId: string): void {
  chatListener = SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event) => {
      if (event.notification.getString('chat_id') === chatId) {
        event.preventDefault(); // before any await: it counts only while the listener runs
      }
    }
  );
}

export function chatScreenClosed(): void {
  chatListener?.remove();
  chatListener = null;
}
// end-snippet
