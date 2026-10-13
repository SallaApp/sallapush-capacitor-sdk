import { registerPlugin } from '@capacitor/core';

export type ConfigSpec = {
  apiBaseUrl?: string;
  logLevel?: string;
  appVersion?: string;
  clearTagsOnLogout?: boolean;
  requiresUserConsent?: boolean;
  openLaunchUrls?: boolean;
  iosAppGroupIdentifier?: string;
  iosApnsEnvironment?: string;
  iosAutoClearBadge?: boolean;
  iosRegisterForRemoteNotificationsOnInit?: boolean;
};
export type Value<T> = { value: T };

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
}

/**
 * The native SallaPush plugin. On a platform without it (the web, or an app that wasn't synced with npx cap sync)
 * every call rejects with Capacitor's UNIMPLEMENTED error.
 */
export const native = registerPlugin<SallaPushNativePlugin>('SallaPush');
