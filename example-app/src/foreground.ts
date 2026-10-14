import { Capacitor } from '@capacitor/core';
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

/** A notification the hold listener prevented, and when it did. */
type HeldNotification = {
  readonly notification: SallaPushNotification;
  readonly heldAt: number;
};

/** display() works for 10 minutes after the event, native's display window. */
const DISPLAY_WINDOW_MS = 600_000;
/** The plugin holds at most 20 on iOS and 500 on Android, dropping the oldest first. */
const MAX_HELD = Capacitor.getPlatform() === 'ios' ? 20 : 500;

let mode: ForegroundMode = 'off';
let held: readonly HeldNotification[] = [];
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let subscription: SallaPushEventSubscription | null = null;
const subscribers = new Set<() => void>();

export const foreground = {
  mode: (): ForegroundMode => mode,
  held: (): readonly SallaPushNotification[] =>
    unexpired().map((item) => item.notification),
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
    const isHeld = unexpired().some(
      (item) => item.notification === notification
    );
    if (isHeld) {
      notification.display();
    }
    held = held.filter((item) => item.notification !== notification);
    eventLog.add(
      'will display',
      `${name(notification)}: ${isHeld ? 'displayed' : 'expired'}`
    );
    changed();
  },
};

function show(event: SallaPushWillDisplayEvent): void {
  eventLog.add('will display', `${name(event.notification)}: shown`);
}

function hold(event: SallaPushWillDisplayEvent): void {
  event.preventDefault();
  held = [
    ...unexpired(),
    { notification: event.notification, heldAt: Date.now() },
  ].slice(-MAX_HELD);
  eventLog.add('will display', `${name(event.notification)}: held`);
  changed();
}

/** Drops the held notifications older than the display window, and returns the others. */
function unexpired(): readonly HeldNotification[] {
  const now = Date.now();
  held = held.filter((item) => now - item.heldAt < DISPLAY_WINDOW_MS);
  return held;
}

/** Tells the subscribers now, and again when the oldest held notification expires. */
function changed(): void {
  clearTimeout(expiryTimer);
  const [oldest] = unexpired();
  expiryTimer =
    oldest === undefined
      ? undefined
      : setTimeout(changed, oldest.heldAt + DISPLAY_WINDOW_MS - Date.now());
  notify();
}

function name(notification: SallaPushNotification): string {
  return notification.title ?? notification.notificationId ?? 'notification';
}

function notify(): void {
  subscribers.forEach((subscriber) => subscriber());
}
