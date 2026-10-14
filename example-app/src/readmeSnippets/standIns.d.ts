// Stand-ins for the app's own code that the README snippets call: declarations only, since the snippets are compiled
// and never run.
import type { OSNotification } from '@onesignal/capacitor-plugin';

/** The app's telemetry, where SallaPush errors go. */
export declare const telemetry: {
  report(
    source: string,
    code: string,
    message: string,
    metadata: Readonly<Record<string, string>>
  ): void;
};

/** The app's settings screen. */
export declare const settingsScreen: {
  showPermission(granted: boolean): void;
  showDevice(deviceId: string | null, optedIn: boolean): void;
  hidePushSettings(): void;
};

/** The app's chat screen, which shows new messages itself while it is open. */
export declare const chat: {
  isOpen(): boolean;
};

/** The app's routing of a notification OneSignal showed. */
export declare function routeOneSignal(notification: OSNotification): void;
