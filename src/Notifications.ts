import { nullable as valueOrNull, send, value } from './internal/calls';
import { native } from './internal/native';
import {
  boolean,
  integer,
  nullable,
  optional,
  record,
  string,
  valid,
} from './internal/validate';
import type {
  SallaPushIOSPermissionStatus,
  SallaPushNotificationsNamespace,
} from './definitions';

// A dropped promise-returning call resolves false, the neutral value of a platform-only call.
export const Notifications: Omit<
  SallaPushNotificationsNamespace,
  'addEventListener' | 'removeEventListener'
> = {
  getPermission: () => value(native.getPermission()),
  canRequestPermission: () => value(native.canRequestPermission()),
  getPermissionStatus: () =>
    valueOrNull(
      native.getPermissionStatus()
    ) as Promise<SallaPushIOSPermissionStatus | null>,
  requestPermission(fallbackToSettings) {
    if (
      !valid('SallaPush.Notifications.requestPermission', {
        fallbackToSettings: [fallbackToSettings, optional(boolean)],
      })
    ) {
      return Promise.resolve(false);
    }
    return value(
      native.requestPermission({
        fallbackToSettings: fallbackToSettings ?? false,
      })
    );
  },
  registerForProvisionalAuthorization: () =>
    value(native.registerForProvisionalAuthorization()),
  refreshPermission: () =>
    send('SallaPush.Notifications.refreshPermission', () =>
      native.refreshPermission()
    ),
  registerForRemoteNotifications: () =>
    send('SallaPush.Notifications.registerForRemoteNotifications', () =>
      native.registerForRemoteNotifications()
    ),
  forwardApnsToken(apnsToken) {
    if (
      valid('SallaPush.Notifications.forwardApnsToken', {
        apnsToken: [apnsToken, string],
      })
    ) {
      send('SallaPush.Notifications.forwardApnsToken', () =>
        native.forwardApnsToken({ apnsToken })
      );
    }
  },
  clearAll: () =>
    send('SallaPush.Notifications.clearAll', () => native.clearAll()),
  removeNotification(androidNotificationId) {
    if (
      valid('SallaPush.Notifications.removeNotification', {
        androidNotificationId: [androidNotificationId, integer],
      })
    ) {
      send('SallaPush.Notifications.removeNotification', () =>
        native.removeNotification({ androidNotificationId })
      );
    }
  },
  isSallaPushNotification(payload) {
    if (
      !valid('SallaPush.Notifications.isSallaPushNotification', {
        payload: [payload, record],
      })
    ) {
      return Promise.resolve(false);
    }
    return value(native.isSallaPushNotification({ payload }));
  },
  trackOpened(additionalData) {
    if (
      !valid('SallaPush.Notifications.trackOpened', {
        additionalData: [additionalData, nullable(record)],
      })
    ) {
      return Promise.resolve(false);
    }
    return value(native.trackOpened({ additionalData }));
  },
};
