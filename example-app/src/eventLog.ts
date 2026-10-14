import {
  SallaPush,
  type SallaPushClickEvent,
  type SallaPushLogEntry,
  type SallaPushLogLevel,
  type SallaPushSubscriptionChangedState,
  type SallaPushUserChangedState,
} from '@salla.sa/sallapush-capacitor';

/** One line of the event log. */
export type EventLine = {
  readonly id: number;
  readonly time: string;
  readonly kind: string;
  readonly text: string;
};

const MAX_LINES = 200;

let lines: readonly EventLine[] = [];
let nextId = 1;
let lastEventId = 0;
let level: SallaPushLogLevel = 'info';
const subscribers = new Set<() => void>();

/** What happened, newest first: SallaPush's events, the example's calls and their results, and log entries. */
export const eventLog = {
  lines: (): readonly EventLine[] => lines,
  /** The newest line that is not a log entry: the status is read again whenever it changes. */
  lastEventId: (): number => lastEventId,
  logLevel: (): SallaPushLogLevel => level,
  subscribe(subscriber: () => void): () => void {
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  },
  add(kind: string, text: string): void {
    const line = {
      id: nextId++,
      time: new Date().toLocaleTimeString(),
      kind,
      text,
    };
    lines = [line, ...lines].slice(0, MAX_LINES);
    if (kind !== 'log') {
      lastEventId = line.id;
    }
    notify();
  },
  clear(): void {
    lines = [];
    notify();
  },
};

/** Listens to every SallaPush event for the log. Called once, at app start, so cold-start taps reach it too. */
export function startEventLog(): void {
  SallaPush.Notifications.addEventListener('click', (event) =>
    eventLog.add('click', describeClick(event))
  );
  SallaPush.Notifications.addEventListener('permissionChange', (permission) =>
    eventLog.add('permission', permission ? 'allowed' : 'not allowed')
  );
  SallaPush.User.addEventListener('change', (state) =>
    eventLog.add('user', describeUser(state))
  );
  SallaPush.User.addEventListener('loginFailure', (failure) =>
    eventLog.add('login failure', failure)
  );
  SallaPush.User.pushSubscription.addEventListener('change', (state) =>
    eventLog.add('subscription', describeSubscription(state))
  );
  followLogs(level);
}

/** Shows SallaPush's log entries at `next` or more severe. */
export function followLogs(next: SallaPushLogLevel): void {
  level = next;
  SallaPush.Debug.setLogHandler(next, (entry) =>
    eventLog.add('log', describeLogEntry(entry))
  );
  notify();
}

/** The push token's last 6 characters: the token is private. */
export function tokenEnd(token: string | null): string {
  return token === null ? 'none' : `…${token.slice(-6)}`;
}

function notify(): void {
  subscribers.forEach((subscriber) => subscriber());
}

function describeClick({ notification, result }: SallaPushClickEvent): string {
  const name =
    notification.title ?? notification.notificationId ?? 'notification';
  return `${name}; url ${result.url ?? 'none'}; actionId ${result.actionId ?? 'none'}`;
}

function describeUser({
  previous,
  current,
}: SallaPushUserChangedState): string {
  const login = current.isLoggedIn ? 'logged in' : 'logged out';
  return `${previous.externalId ?? 'guest'} → ${current.externalId ?? 'guest'}, ${login}`;
}

function describeSubscription({
  current,
}: SallaPushSubscriptionChangedState): string {
  const optedIn = current.optedIn ? 'opted in' : 'opted out';
  return `id ${current.id ?? 'none'}, token ${tokenEnd(current.token)}, ${optedIn}`;
}

function describeLogEntry(entry: SallaPushLogEntry): string {
  return `${entry.level} ${entry.code}: ${entry.message}`;
}
