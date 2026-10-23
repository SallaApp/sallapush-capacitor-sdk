import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { SallaPush } from '@salla.sa/sallapush-capacitor';

// The setup guide's "Another push plugin": with @capacitor-firebase/messaging, Firebase also holds the APNs token.
// Optional: the AppDelegate's forwarding lines already give it to SallaPush.

export function forwardApnsTokenFromFirebase(): void {
  // snippet:firebase-apns-token
  FirebaseMessaging.addListener('apnsTokenReceived', ({ token }) =>
    SallaPush.Notifications.forwardApnsToken(token)
  );
  // end-snippet
}
