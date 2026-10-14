import {
  SallaPush,
  type SallaPushEventSubscription,
  type SallaPushNotification,
  type SallaPushWillDisplayEvent,
} from '@salla.sa/sallapush-capacitor';
import { eventLog } from './eventLog';

/**
 * What happens to SallaPush notifications that arrive while the app is in the foreground. Off: no listener, so
 * SallaPush shows the original itself. Show: a listener that doesn't prevent. Hold: a listener that prevents, keeping
 * each notification for a later display().
 */
export type ForegroundMode = 'off' | 'show' | 'hold';

let mode: ForegroundMode = 'off';
let held: readonly SallaPushNotification[] = [];
let subscription: SallaPushEventSubscription | null = null;
const subscribers = new Set<() => void>();

export const foreground = {
  mode: (): ForegroundMode => mode,
  held: (): readonly SallaPushNotification[] => held,
  subscribe(subscriber: () => void): () => void {
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  },
  setMode(next: ForegroundMode): void {
    if (next === mode) {
      return;
    }
    subscription?.remove();
    subscription =
      next === 'off'
        ? null
        : SallaPush.Notifications.addEventListener(
            'foregroundWillDisplay',
            next === 'hold' ? hold : show
          );
    mode = next;
    notify();
  },
  display(notification: SallaPushNotification): void {
    notification.display();
    held = held.filter((item) => item !== notification);
    eventLog.add('will display', `${name(notification)}: displayed`);
    notify();
  },
};

function show(event: SallaPushWillDisplayEvent): void {
  eventLog.add('will display', `${name(event.notification)}: shown`);
}

function hold(event: SallaPushWillDisplayEvent): void {
  event.preventDefault();
  held = [...held, event.notification];
  eventLog.add('will display', `${name(event.notification)}: held`);
  notify();
}

function name(notification: SallaPushNotification): string {
  return notification.title ?? notification.notificationId ?? 'notification';
}

function notify(): void {
  subscribers.forEach((subscriber) => subscriber());
}
