import { Debug } from './Debug';
import { Migration } from './Migration';
import { Notifications } from './Notifications';
import { User } from './User';
import { nullable, send, value } from './internal/calls';
import { native, type ConfigSpec } from './internal/native';
import {
  apnsEnvironment,
  boolean,
  logLevel,
  optional,
  record,
  string,
  valid,
} from './internal/validate';
import type {
  SallaPushConfig,
  SallaPushDebugNamespace,
  SallaPushMigrationNamespace,
  SallaPushNotificationsNamespace,
  SallaPushUserNamespace,
} from './definitions';

/**
 * SallaPush for Capacitor. Every call is safe at any time, before or after initialization. On the web SallaPush isn't
 * available: requests reject with Capacitor's `UNIMPLEMENTED` error, and other calls print one console error each.
 */
export const SallaPush: {
  /**
   * Starts SallaPush when the app id is known only at run time. Apps that set the static app id (SallaPushAppId /
   * com.salla.push.APP_ID) never need it: SallaPush has already started natively, and a call with the same app id and
   * API URL changes nothing, its config included.
   */
  initialize(appId: string, config?: SallaPushConfig): void;
  /** Whether SallaPush is running. */
  isInitialized(): Promise<boolean>;
  /** The app id SallaPush runs with; null before it started. */
  getAppId(): Promise<string | null>;
  /** The native SallaPush SDK version on this platform, for example "1.0.2". */
  getSdkVersion(): Promise<string>;
  /**
   * Requires consent before any data processing. With the static app id, require consent with the static key
   * (SallaPushRequiresUserConsent / com.salla.push.REQUIRES_USER_CONSENT) instead: SallaPush starts before JavaScript.
   */
  setConsentRequired(required: boolean): void;
  /**
   * The user's consent, saved for the app. `false`, while consent is required, withdraws consent that was given: the
   * device opts out, its tags are deleted and it is unlinked on the server.
   */
  setConsentGiven(given: boolean): void;
  /**
   * Links this device to the customer who signed in, once Salla has checked their token. `externalId` is the
   * customer's id, and `identityToken` the customer token your app received from Salla when the customer signed in,
   * without a `Bearer ` prefix. SallaPush keeps the token in memory only: call login again whenever your app refreshes
   * it, and call logout() before another customer's login. A refusal reaches the User 'loginFailure' listeners, once
   * per refusal; there is no success event.
   */
  login(externalId: string, identityToken: string): void;
  /**
   * Unlinks the device from the customer; it stays registered as a guest. Needs no token, works offline, and is
   * retried until the server confirms it. Call it at every sign-out, and at launch while no customer is signed in.
   */
  logout(): void;
  /** The customer, and this device's tags, language and push subscription. */
  readonly User: SallaPushUserNamespace;
  /** The notification permission, listeners for taps and foreground notifications, and helpers for other SDKs. */
  readonly Notifications: SallaPushNotificationsNamespace;
  /** SallaPush's log level and log handler. */
  readonly Debug: SallaPushDebugNamespace;
  /** Settings for apps that move from OneSignal. */
  readonly Migration: SallaPushMigrationNamespace;
} = {
  initialize(appId, config) {
    if (
      !valid('SallaPush.initialize', {
        appId: [appId, string],
        config: [config, optional(record)],
      })
    ) {
      return;
    }
    const spec = configSpec(config ?? {});
    if (spec) {
      send('SallaPush.initialize', () =>
        native.initialize({ appId, config: spec })
      );
    }
  },
  isInitialized: () => value(native.isInitialized()),
  getAppId: () => nullable(native.getSallaPushAppId()),
  getSdkVersion: () => value(native.getSdkVersion()),
  setConsentRequired(required) {
    if (
      valid('SallaPush.setConsentRequired', { required: [required, boolean] })
    ) {
      send('SallaPush.setConsentRequired', () =>
        native.setConsentRequired({ required })
      );
    }
  },
  setConsentGiven(given) {
    if (valid('SallaPush.setConsentGiven', { given: [given, boolean] })) {
      send('SallaPush.setConsentGiven', () =>
        native.setConsentGiven({ given })
      );
    }
  },
  login(externalId, identityToken) {
    if (
      valid('SallaPush.login', {
        externalId: [externalId, string],
        identityToken: [identityToken, string],
      })
    ) {
      send('SallaPush.login', () =>
        native.login({ externalId, identityToken })
      );
    }
  },
  logout: () => send('SallaPush.logout', () => native.logout()),
  User,
  Notifications,
  Debug,
  Migration,
};

/** The config as the native plugin takes it, with only the options that are set; null when an option is mistyped. */
function configSpec(config: SallaPushConfig): ConfigSpec | null {
  if (
    !valid('SallaPush.initialize', {
      'config.apiBaseUrl': [config.apiBaseUrl, optional(string)],
      'config.logLevel': [config.logLevel, optional(logLevel)],
      'config.appVersion': [config.appVersion, optional(string)],
      'config.clearTagsOnLogout': [config.clearTagsOnLogout, optional(boolean)],
      'config.requiresUserConsent': [
        config.requiresUserConsent,
        optional(boolean),
      ],
      'config.openLaunchUrls': [config.openLaunchUrls, optional(boolean)],
      'config.autoClearBadge': [config.autoClearBadge, optional(boolean)],
      'config.autoUpdateBadge': [config.autoUpdateBadge, optional(boolean)],
      'config.ios': [config.ios, optional(record)],
    })
  ) {
    return null;
  }
  const ios = config.ios ?? {};
  if (
    !valid('SallaPush.initialize', {
      'config.ios.appGroupIdentifier': [
        ios.appGroupIdentifier,
        optional(string),
      ],
      'config.ios.apnsEnvironment': [
        ios.apnsEnvironment,
        optional(apnsEnvironment),
      ],
      'config.ios.autoClearBadge': [ios.autoClearBadge, optional(boolean)],
      'config.ios.registerForRemoteNotificationsOnInit': [
        ios.registerForRemoteNotificationsOnInit,
        optional(boolean),
      ],
    })
  ) {
    return null;
  }
  return setFields({
    apiBaseUrl: config.apiBaseUrl,
    logLevel: config.logLevel,
    appVersion: config.appVersion,
    clearTagsOnLogout: config.clearTagsOnLogout,
    requiresUserConsent: config.requiresUserConsent,
    openLaunchUrls: config.openLaunchUrls,
    autoClearBadge: config.autoClearBadge,
    autoUpdateBadge: config.autoUpdateBadge,
    iosAppGroupIdentifier: ios.appGroupIdentifier,
    iosApnsEnvironment: ios.apnsEnvironment,
    iosAutoClearBadge: ios.autoClearBadge,
    iosRegisterForRemoteNotificationsOnInit:
      ios.registerForRemoteNotificationsOnInit,
  });
}

/**
 * The fields that are set, so the bridges read every other option as native's default. A loop, not
 * Object.fromEntries, which the ES2017 build doesn't have.
 */
function setFields(spec: ConfigSpec): ConfigSpec {
  const fields: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(spec)) {
    if (field !== undefined && field !== null) {
      fields[key] = field;
    }
  }
  return fields as ConfigSpec;
}
