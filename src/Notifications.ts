import { EventHub, addListener, removeListener } from './internal/EventHub';
import { nullable as valueOrNull, send, value } from './internal/calls';
import { clickEvent, permissionChange } from './internal/mapping';
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

const hubs = {
  click: new EventHub({
    kind: 'click',
    name: "SallaPush.Notifications 'click' listener",
    connect: (dispatch) => native.addListener('click', dispatch),
    map: clickEvent,
  }),
  permissionChange: new EventHub({
    kind: 'permission',
    name: "SallaPush.Notifications 'permissionChange' listener",
    connect: (dispatch) => native.addListener('permissionChange', dispatch),
    map: permissionChange,
  }),
};

// A dropped promise-returning call resolves false, the neutral value of a platform-only call.
export const Notifications: SallaPushNotificationsNamespace = {
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
  addEventListener: (event: unknown, listener: unknown) =>
    addListener(
      'SallaPush.Notifications.addEventListener',
      hubs,
      event,
      listener
    ),
  removeEventListener: (event: unknown, listener: unknown) =>
    removeListener(
      'SallaPush.Notifications.removeEventListener',
      hubs,
      event,
      listener
    ),
};
