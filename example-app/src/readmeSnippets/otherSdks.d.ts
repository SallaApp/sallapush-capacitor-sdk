// Stand-ins for the parts of other SDKs that the README snippets use, with the signatures of the versions named below,
// so the snippets type-check exactly as the README shows them without those SDKs in the example.

// @capacitor-firebase/messaging 8.5.2
declare module '@capacitor-firebase/messaging' {
  import type { PluginListenerHandle } from '@capacitor/core';

  export interface ApnsTokenReceivedEvent {
    /** The native APNs token as an uppercase hex-encoded string. */
    token: string;
  }

  export type ApnsTokenReceivedListener = (
    event: ApnsTokenReceivedEvent
  ) => void;

  export interface FirebaseMessagingPlugin {
    addListener(
      eventName: 'apnsTokenReceived',
      listenerFunc: ApnsTokenReceivedListener
    ): Promise<PluginListenerHandle>;
  }

  export const FirebaseMessaging: FirebaseMessagingPlugin;
}

// @onesignal/capacitor-plugin 1.2.0
declare module '@onesignal/capacitor-plugin' {
  export class OSNotification {
    body: string;
    title?: string;
    launchURL?: string;
    rawPayload: object;
    additionalData: object;
    notificationId: string;
    display(): void;
  }

  export interface NotificationClickResult {
    actionId?: string;
    url?: string;
  }

  export interface NotificationClickEvent {
    result: NotificationClickResult;
    notification: OSNotification;
  }

  export class NotificationWillDisplayEvent {
    preventDefault(discard?: boolean): void;
    getNotification(): OSNotification;
  }

  type NotificationEventTypeMap = {
    click: NotificationClickEvent;
    foregroundWillDisplay: NotificationWillDisplayEvent;
    permissionChange: boolean;
  };

  interface Notifications {
    addEventListener<K extends keyof NotificationEventTypeMap>(
      event: K,
      listener: (event: NotificationEventTypeMap[K]) => void
    ): void;
  }

  interface PushSubscription {
    optIn(): Promise<void>;
    optOut(): Promise<void>;
  }

  interface User {
    pushSubscription: PushSubscription;
  }

  interface OneSignalPlugin {
    User: User;
    Notifications: Notifications;
  }

  const OneSignal: OneSignalPlugin;
  export default OneSignal;
}
