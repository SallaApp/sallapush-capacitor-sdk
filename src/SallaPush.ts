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
import type { SallaPushConfig } from './definitions';

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
  isInitialized(): Promise<boolean>;
  getAppId(): Promise<string | null>;
  /** The native SallaPush SDK version on this platform, for example "1.0.2". */
  getSdkVersion(): Promise<string>;
  /**
   * Requires consent before any data processing. With the static app id, require consent with the static key
   * (SallaPushRequiresUserConsent / com.salla.push.REQUIRES_USER_CONSENT) instead: SallaPush starts before JavaScript.
   */
  setConsentRequired(required: boolean): void;
  setConsentGiven(given: boolean): void;
  login(externalId: string, identityToken: string): void;
  logout(): void;
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
