import { Capacitor } from '@capacitor/core';
import {
  SallaPush,
  type SallaPushIOSPermissionStatus,
  type SallaPushLogLevel,
} from '@salla.sa/sallapush-capacitor';
import { renderActions } from './actions';
import { eventLog, tokenEnd } from './eventLog';
import { renderEventLog, renderForeground } from './events';
import { button, element, note, output, section } from './ui';

type Status = {
  sdkVersion: string;
  initialized: boolean;
  appId: string | null;
  deviceId: string | null;
  tokenEnd: string;
  optedIn: boolean;
  permission: boolean;
  permissionStatus: SallaPushIOSPermissionStatus | null;
  externalId: string | null;
  loggedIn: boolean;
  tags: Record<string, string>;
  logLevel: SallaPushLogLevel;
};

/** Renders the example into `root`: SallaPush's status, every action, the foreground modes and the event log. */
export function renderApp(root: HTMLElement): void {
  const banner = element(
    'p',
    'banner',
    "Not configured: SallaPush didn't start, since this build has no valid app id. Set SALLAPUSH_APP_ID (iOS) or " +
      'sallapushAppId (Android) as example-app/README.md shows.'
  );
  banner.hidden = true;
  const lines = element('div', 'lines');
  const refresh = statusView(banner, lines);
  root.replaceChildren(
    element('h1', 'title', 'SallaPush example'),
    banner,
    section('Status', lines, button('Refresh', refresh)),
    ...renderActions(),
    renderForeground(),
    renderEventLog()
  );
  let lastEvent = eventLog.lastEventId();
  eventLog.subscribe(() => {
    if (eventLog.lastEventId() !== lastEvent) {
      lastEvent = eventLog.lastEventId();
      refresh();
    }
  });
  refresh();
}

/** SallaPush's state, read again on every event of the log and with the Refresh button: returns the refresh. */
function statusView(banner: HTMLElement, lines: HTMLElement): () => void {
  let latest = 0;
  return () => {
    const request = ++latest;
    readStatus().then(
      (status) => {
        if (request === latest) {
          banner.hidden = status.initialized;
          lines.replaceChildren(...statusLines(status));
        }
      },
      (error: unknown) => {
        if (request === latest) {
          lines.replaceChildren(
            note(
              `SallaPush isn't available here: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    );
  };
}

async function readStatus(): Promise<Status> {
  const subscription = SallaPush.User.pushSubscription;
  const [
    sdkVersion,
    initialized,
    appId,
    deviceId,
    token,
    optedIn,
    permission,
    permissionStatus,
    externalId,
    loggedIn,
    tags,
    logLevel,
  ] = await Promise.all([
    SallaPush.getSdkVersion(),
    SallaPush.isInitialized(),
    SallaPush.getAppId(),
    subscription.getId(),
    subscription.getToken(),
    subscription.getOptedIn(),
    SallaPush.Notifications.getPermission(),
    SallaPush.Notifications.getPermissionStatus(),
    SallaPush.User.getExternalId(),
    SallaPush.User.isLoggedIn(),
    SallaPush.User.getTags(),
    SallaPush.Debug.getLogLevel(),
  ]);
  return {
    sdkVersion,
    initialized,
    appId,
    deviceId,
    tokenEnd: tokenEnd(token),
    optedIn,
    permission,
    permissionStatus,
    externalId,
    loggedIn,
    tags,
    logLevel,
  };
}

function statusLines(status: Status): HTMLElement[] {
  const permission = status.permission ? 'allowed' : 'not allowed';
  const tags = Object.entries(status.tags)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return [
    output('SDK', status.sdkVersion),
    output('App id', status.appId ?? 'none'),
    output('Device id', status.deviceId ?? 'not registered'),
    output('Token', status.tokenEnd),
    output('Opted in', status.optedIn ? 'yes' : 'no'),
    output(
      'Permission',
      Capacitor.getPlatform() === 'ios'
        ? `${permission} (${status.permissionStatus})`
        : permission
    ),
    output(
      'Customer',
      status.loggedIn ? (status.externalId ?? 'logged in') : 'logged out'
    ),
    output('Tags', tags === '' ? 'none' : tags),
    output('Console log level', status.logLevel),
  ];
}
