import type {
  ClickEventSpec,
  LoginFailureSpec,
  NotificationSpec,
  PermissionChangeSpec,
  SubscriptionChangedSpec,
  SubscriptionStateSpec,
  UserChangedSpec,
  UserStateSpec,
} from './native';
import type {
  SallaPushClickEvent,
  SallaPushLoginFailure,
  SallaPushNotification,
  SallaPushPayloadSource,
  SallaPushSubscriptionChangedState,
  SallaPushSubscriptionState,
  SallaPushUserChangedState,
  SallaPushUserState,
} from '../definitions';
import { warnOnce } from './consoleOnce';
import { string, valid } from './validate';

/** A notification as native sent it, with typed getters that read the results of native's own accessors. */
export function notification(spec: NotificationSpec): SallaPushNotification {
  return Object.freeze({
    notificationId: spec.notificationId ?? null,
    title: spec.title ?? null,
    subtitle: spec.subtitle ?? null,
    body: spec.body ?? null,
    imageUrl: spec.imageUrl ?? null,
    launchUrl: spec.launchUrl ?? null,
    additionalData: spec.additionalData as Readonly<Record<string, unknown>>,
    rawPayload: spec.rawPayload as Readonly<Record<string, unknown>>,
    source: spec.source as SallaPushPayloadSource,
    sound: spec.sound ?? null,
    badge: spec.badge ?? null,
    threadId: spec.threadId ?? null,
    androidNotificationId: spec.androidNotificationId ?? null,
    collapseId: spec.collapseId ?? null,
    channelId: spec.channelId ?? null,
    getString: (key: string) =>
      typedValue('getString', spec.stringValues, key) as string | null,
    getInt: (key: string) =>
      typedValue('getInt', spec.intValues, key) as number | null,
    getBool: (key: string) =>
      typedValue('getBool', spec.boolValues, key) as boolean | null,
    getNumber: (key: string) =>
      typedValue('getNumber', spec.numberValues, key) as number | null,
    display,
  });
}

export function clickEvent(spec: ClickEventSpec): SallaPushClickEvent {
  return Object.freeze({
    notification: notification(spec.notification),
    result: Object.freeze({
      actionId: spec.actionId ?? null,
      url: spec.url ?? null,
    }),
  });
}

export function permissionChange(spec: PermissionChangeSpec): boolean {
  return spec.permission;
}

export function userChange(spec: UserChangedSpec): SallaPushUserChangedState {
  return Object.freeze({
    previous: userState(spec.previous),
    current: userState(spec.current),
  });
}

export function loginFailure(spec: LoginFailureSpec): SallaPushLoginFailure {
  return spec.failure as SallaPushLoginFailure;
}

export function subscriptionChange(
  spec: SubscriptionChangedSpec
): SallaPushSubscriptionChangedState {
  return Object.freeze({
    previous: subscriptionState(spec.previous),
    current: subscriptionState(spec.current),
  });
}

function userState(spec: UserStateSpec): SallaPushUserState {
  return Object.freeze({
    externalId: spec.externalId ?? null,
    isLoggedIn: spec.isLoggedIn,
  });
}

function subscriptionState(
  spec: SubscriptionStateSpec
): SallaPushSubscriptionState {
  return Object.freeze({
    id: spec.id ?? null,
    token: spec.token ?? null,
    optedIn: spec.optedIn,
  });
}

// A tapped notification was shown already: display() shows only the notification of a 'foregroundWillDisplay' event.
function display(): void {
  warnOnce(
    'SallaPushNotification.display',
    "SallaPushNotification.display() does nothing here: it shows only the notification of a 'foregroundWillDisplay' " +
      'event.'
  );
}

/** Native's accessor result for `key`; null when native had none, and for keys inherited from Object.prototype. */
function typedValue(
  getter: string,
  values: Record<string, unknown>,
  key: string
): unknown {
  if (!valid(`SallaPushNotification.${getter}`, { key: [key, string] })) {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}
