import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type ConfigSpec = {
  logLevel?: string;
  appVersion?: string;
  clearTagsOnLogout?: boolean;
  requiresUserConsent?: boolean;
  openLaunchUrls?: boolean;
  autoClearBadge?: boolean;
  autoUpdateBadge?: boolean;
  iosAppGroupIdentifier?: string;
  iosApnsEnvironment?: string;
  iosRegisterForRemoteNotificationsOnInit?: boolean;
};
export type NotificationSpec = {
  notificationId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  launchUrl?: string | null;
  additionalData: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  source: string;
  // The non-null results of native's typed accessors for each top-level additionalData key.
  stringValues: Record<string, unknown>;
  intValues: Record<string, unknown>;
  boolValues: Record<string, unknown>;
  numberValues: Record<string, unknown>;
  sound?: string | null;
  badge?: number | null;
  threadId?: string | null;
  androidNotificationId?: number | null;
  collapseId?: string | null;
  channelId?: string | null;
};
export type ClickEventSpec = {
  notification: NotificationSpec;
  actionId?: string | null;
  url?: string | null;
};
export type WillDisplayEventSpec = {
  handle: string;
  notification: NotificationSpec;
};
export type PermissionChangeSpec = { permission: boolean };
export type SubscriptionStateSpec = {
  id?: string | null;
  token?: string | null;
  optedIn: boolean;
};
export type SubscriptionChangedSpec = {
  listenerId: number;
  previous: SubscriptionStateSpec;
  current: SubscriptionStateSpec;
};
export type UserStateSpec = { externalId?: string | null; isLoggedIn: boolean };
export type UserChangedSpec = {
  previous: UserStateSpec;
  current: UserStateSpec;
};
export type LoginFailureSpec = { failure: string };
export type LogEntrySpec = {
  level: string;
  category: string;
  code: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: number;
};
export type Value<T> = { value: T };

/** The native registrations startEvents and stopEvents take; push-subscription listeners register by id instead. */
export type EventKind =
  'click' | 'willDisplay' | 'permission' | 'user' | 'loginFailure' | 'log';

export interface SallaPushNativePlugin {
  initialize(options: { appId: string; config: ConfigSpec }): Promise<void>;
  isInitialized(): Promise<Value<boolean>>;
  getSallaPushAppId(): Promise<Value<string | null>>;
  getSdkVersion(): Promise<Value<string>>;
  setConsentRequired(options: { required: boolean }): Promise<void>;
  setConsentGiven(options: { given: boolean }): Promise<void>;
  login(options: { externalId: string; identityToken: string }): Promise<void>;
  logout(): Promise<void>;

  getExternalId(): Promise<Value<string | null>>;
  isLoggedIn(): Promise<Value<boolean>>;
  addTag(options: { key: string; value: string }): Promise<void>;
  addTags(options: { tags: Record<string, unknown> }): Promise<void>;
  removeTag(options: { key: string }): Promise<void>;
  removeTags(options: { keys: unknown[] }): Promise<void>;
  getTags(): Promise<Value<Record<string, string>>>;
  setLanguage(options: { language: string | null }): Promise<void>;

  getPushSubscriptionId(): Promise<Value<string | null>>;
  getPushSubscriptionToken(): Promise<Value<string | null>>;
  getPushSubscriptionOptedIn(): Promise<Value<boolean>>;
  optIn(): Promise<void>;
  optOut(): Promise<void>;
  addPushSubscriptionListener(options: { listenerId: number }): Promise<void>;
  removePushSubscriptionListener(options: {
    listenerId: number;
  }): Promise<void>;

  getPermission(): Promise<Value<boolean>>;
  canRequestPermission(): Promise<Value<boolean>>;
  getPermissionStatus(): Promise<Value<string | null>>;
  requestPermission(options: {
    fallbackToSettings: boolean;
  }): Promise<Value<boolean>>;
  registerForProvisionalAuthorization(): Promise<Value<boolean>>;
  refreshPermission(): Promise<void>;
  registerForRemoteNotifications(): Promise<void>;
  forwardApnsToken(options: { apnsToken: string }): Promise<void>;
  clearAll(): Promise<void>;
  removeNotification(options: { androidNotificationId: number }): Promise<void>;
  isSallaPushNotification(options: {
    payload: Record<string, unknown>;
  }): Promise<Value<boolean>>;
  trackOpened(options: {
    additionalData: Record<string, unknown> | null;
  }): Promise<Value<boolean>>;
  displayNotification(options: { handle: string }): Promise<void>;

  setDisplayCompatPayloads(options: { display: boolean }): Promise<void>;

  getLogLevel(): Promise<Value<string>>;
  setLogLevel(options: { level: string }): Promise<void>;
  setLogHandlerLevel(options: { level: string }): Promise<void>;

  startEvents(options: { kind: EventKind }): Promise<void>;
  stopEvents(options: { kind: EventKind }): Promise<void>;

  addListener(
    eventName: 'click',
    listenerFunc: (event: ClickEventSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'willDisplay',
    listenerFunc: (event: WillDisplayEventSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'permissionChange',
    listenerFunc: (event: PermissionChangeSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'userChange',
    listenerFunc: (event: UserChangedSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'loginFailure',
    listenerFunc: (event: LoginFailureSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'pushSubscriptionChange',
    listenerFunc: (event: SubscriptionChangedSpec) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'log',
    listenerFunc: (event: LogEntrySpec) => void
  ): Promise<PluginListenerHandle>;
}

/**
 * The native SallaPush plugin. On a platform without it (the web, or an app that wasn't synced with npx cap sync)
 * every call rejects with Capacitor's UNIMPLEMENTED error.
 */
export const native = registerPlugin<SallaPushNativePlugin>('SallaPush');
