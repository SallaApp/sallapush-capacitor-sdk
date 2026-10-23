/** SallaPush's log levels, from the quietest. */
export const SallaPushLogLevel = {
  Off: 'off',
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
  Debug: 'debug',
  Verbose: 'verbose',
} as const;
export type SallaPushLogLevel =
  (typeof SallaPushLogLevel)[keyof typeof SallaPushLogLevel];

/** The APNs environment SallaPush registers the iOS device token for. */
export const SallaPushAPNsEnvironment = {
  Automatic: 'automatic',
  Sandbox: 'sandbox',
  Production: 'production',
} as const;
export type SallaPushAPNsEnvironment =
  (typeof SallaPushAPNsEnvironment)[keyof typeof SallaPushAPNsEnvironment];

/** iOS's notification authorization status. */
export const SallaPushIOSPermissionStatus = {
  NotDetermined: 'notDetermined',
  Denied: 'denied',
  Authorized: 'authorized',
  Provisional: 'provisional',
  Ephemeral: 'ephemeral',
} as const;
export type SallaPushIOSPermissionStatus =
  (typeof SallaPushIOSPermissionStatus)[keyof typeof SallaPushIOSPermissionStatus];

/** Why SallaPush's server refused the current login. */
export const SallaPushLoginFailure = {
  /**
   * The SallaPush server refused the token for this external id: it expired, was revoked or is another customer's, it
   * has a Bearer prefix, or Salla couldn't check it. Call login again when the app next refreshes the token or at the
   * next launch, never from the loginFailure listener.
   */
  TokenRejected: 'tokenRejected',
  /** The login request was refused; it is not sent again. */
  InvalidRequest: 'invalidRequest',
} as const;
export type SallaPushLoginFailure =
  (typeof SallaPushLoginFailure)[keyof typeof SallaPushLoginFailure];

/** The format a notification arrived in: SallaPush's own, or the OneSignal-compatible one used while apps migrate. */
export const SallaPushPayloadSource = {
  Native: 'native',
  Compat: 'compat',
} as const;
export type SallaPushPayloadSource =
  (typeof SallaPushPayloadSource)[keyof typeof SallaPushPayloadSource];

/**
 * A SallaPush notification. Route with the typed getters: native payloads carry their data as strings, while
 * OneSignal-compatible ones keep JSON types.
 */
export interface SallaPushNotification {
  /** The SallaPush message id; null when the payload has none. */
  readonly notificationId: string | null;
  /** The title; null when the notification has none. */
  readonly title: string | null;
  /** The subtitle; null when the notification has none. */
  readonly subtitle: string | null;
  /** The text; null when the notification has none. */
  readonly body: string | null;
  /** The image, https only; null when the notification has none. */
  readonly imageUrl: string | null;
  /**
   * The launch URL as sent. SallaPush opens https URLs itself only with the open-launch-URLs option, and the click
   * listener then must not open the URL again. It is the sender's text, of any scheme: check its scheme and host before
   * opening it, since a `javascript:` URL assigned to `window.location` runs in the app's page.
   */
  readonly launchUrl: string | null;
  /** The custom data. JavaScript numbers lose precision beyond 2^53. */
  readonly additionalData: Readonly<Record<string, unknown>>;
  /** The payload as received; on Android the FCM data map, where `custom` stays JSON text. */
  readonly rawPayload: Readonly<Record<string, unknown>>;
  /** The payload's format: SallaPush's own, or the OneSignal-compatible one. */
  readonly source: SallaPushPayloadSource;
  /** The sound the payload names; null when it names none. */
  readonly sound: string | null;
  /** iOS only; null on Android. */
  readonly badge: number | null;
  /** iOS only; null on Android. */
  readonly threadId: string | null;
  /** Android only; null on iOS. */
  readonly androidNotificationId: number | null;
  /** Android only; null on iOS. */
  readonly collapseId: string | null;
  /** Android only; null on iOS. */
  readonly channelId: string | null;
  /**
   * A top-level additionalData value as native's string(forKey:) / getString reads it: numbers and booleans are
   * converted; null when absent or not convertible.
   */
  getString(key: string): string | null;
  /** As native's int(forKey:) / getLong: exact or null; integers beyond 2^53 lose precision in JavaScript. */
  getInt(key: string): number | null;
  /** As native's bool(forKey:) / getBoolean: true and false, 1 and 0, and their string forms. */
  getBool(key: string): boolean | null;
  /** iOS only: as native's number(forKey:); null on Android. */
  getNumber(key: string): number | null;
  /**
   * Shows a foreground notification a 'foregroundWillDisplay' listener prevented, once, within 10 minutes of its event.
   * Does nothing before event.preventDefault(), as natively, and for any other notification.
   */
  display(): void;
}

/** What a tap asked for. */
export interface SallaPushClickResult {
  /** The tapped action button (iOS custom actions); null for a tap on the notification itself, and always on Android. */
  readonly actionId: string | null;
  /** The notification's launch URL. */
  readonly url: string | null;
}

/** A tap on a SallaPush notification. */
export interface SallaPushClickEvent {
  /** The notification that was tapped. */
  readonly notification: SallaPushNotification;
  /** The action button and the launch URL of the tap. */
  readonly result: SallaPushClickResult;
}

/** A SallaPush notification about to be shown while the app is in the foreground. */
export interface SallaPushWillDisplayEvent {
  /** The notification about to be shown. */
  readonly notification: SallaPushNotification;
  /** Whether a listener called preventDefault(), so the notification stays hidden. */
  readonly isPrevented: boolean;
  /**
   * Keeps the notification hidden. It counts only when called before the listener returns, so call it before any
   * await. A prevented notification can be shown later with notification.display().
   */
  preventDefault(): void;
}

/** The push subscription at one moment. */
export interface SallaPushSubscriptionState {
  /** The SallaPush device id; null until the device has registered. */
  readonly id: string | null;
  /** The push token. It is private: never send it to analytics or logs. */
  readonly token: string | null;
  /** Permission granted, not opted out, and a token. */
  readonly optedIn: boolean;
}

/** A change of the push subscription. */
export interface SallaPushSubscriptionChangedState {
  /** The state before the change; equal to current in the first event a new listener gets. */
  readonly previous: SallaPushSubscriptionState;
  /** The state after the change. */
  readonly current: SallaPushSubscriptionState;
}

/** The customer this device is logged in for, at one moment. */
export interface SallaPushUserState {
  /** The external id of the login; null for a guest. */
  readonly externalId: string | null;
  /** Whether a customer is logged in on this device. */
  readonly isLoggedIn: boolean;
}

/** A change of the customer login. */
export interface SallaPushUserChangedState {
  /** The login before the change. */
  readonly previous: SallaPushUserState;
  /** The login after the change. */
  readonly current: SallaPushUserState;
}

/**
 * One SallaPush log entry. Native leaves out secrets and identity tokens. Don't forward info entries to third parties:
 * on iOS, the info entries `status.launch` and `status.changed` describe the push token and the customer's link, with
 * the full token and the customer's id when a debug build sets the Info.plist key SallaPushLogFullIdentifiers.
 */
export interface SallaPushLogEntry {
  /** The entry's level. */
  readonly level: SallaPushLogLevel;
  /** The area: lifecycle, registration, identity, notifications, events, tags, network, storage, consent. */
  readonly category: string;
  /** A stable code, such as register.ok. */
  readonly code: string;
  /** What happened, in words. It may change between versions: match on code instead. */
  readonly message: string;
  /** Details such as http_status, error_code and request_id. */
  readonly metadata: Readonly<Record<string, string>>;
  /** Milliseconds since the epoch. */
  readonly timestamp: number;
}

/** A listener's registration. */
export interface SallaPushEventSubscription {
  /** Removes the listener; calling it again does nothing. */
  remove(): void;
}

/** Options for `SallaPush.initialize`. An option that is left out keeps native's default. */
export interface SallaPushConfig {
  /**
   * The SallaPush server's URL, ending in `/notifications/v1/sallapush`. Default: the native key
   * (SallaPushAPIBaseURL / com.salla.push.API_BASE_URL), else SallaPush's production URL. https only; http only for
   * local development hosts.
   */
  apiBaseUrl?: string;
  /** The console log level. Default: the native key (SallaPushLogLevel / com.salla.push.LOG_LEVEL), else `warn`. */
  logLevel?: SallaPushLogLevel;
  /** The app version sent to SallaPush. Default: CFBundleShortVersionString on iOS, versionName on Android. */
  appVersion?: string;
  /** Deletes the device's tags on logout and when another customer logs in. Default `true`. */
  clearTagsOnLogout?: boolean;
  /**
   * Requires `setConsentGiven(true)` before SallaPush sends or stores anything but the consent answer. Default
   * `false`.
   */
  requiresUserConsent?: boolean;
  /** SallaPush opens https launch URLs on tap. The click listener still gets the tap: it must not open the URL again. */
  openLaunchUrls?: boolean;
  /**
   * Clears the app icon's badge when the app opens. Default `true`. On iOS, SallaPush sets the badge, and its count of
   * SallaPush notifications, to 0 every time the app becomes active; on iOS 15 that can also remove the app's delivered
   * notifications. On Android, SallaPush removes its notifications that show on the badge from the shade when the app
   * comes to the foreground (Android 8.0 and later), but not when the phone was unlocked with the app on screen.
   */
  autoClearBadge?: boolean;
  /**
   * SallaPush raises and lowers the app icon's badge for its notifications. Default `true`. On iOS, the Notification
   * Service Extension counts each SallaPush notification, which needs the extension and the same App Group in the app
   * and the extension; `false` sets no number, and a push's own badge applies. On Android, SallaPush creates its
   * notification channels with badges; `false` creates them without, and Android keeps a channel's badge setting once
   * the channel exists.
   */
  autoUpdateBadge?: boolean;
  /** iOS only; ignored on Android. */
  ios?: {
    /**
     * The App Group shared with the Notification Service Extension, which badge counting and the extension's
     * `received` need. Default: the SallaPushAppGroup key.
     */
    appGroupIdentifier?: string;
    /** The APNs environment of this build. Default `automatic`: read from the provisioning profile. */
    apnsEnvironment?: SallaPushAPNsEnvironment;
    /**
     * @deprecated Use the top-level `autoClearBadge`, which applies on both platforms. This one still applies on iOS
     * when `autoClearBadge` is left out.
     */
    autoClearBadge?: boolean;
    /**
     * Registers for remote notifications when SallaPush starts, unless consent is required and not given. Default
     * `true`; set it to `false` only if the app registers at every launch itself.
     */
    registerForRemoteNotificationsOnInit?: boolean;
  };
}

/** The customer, and this device's tags and language. */
export interface SallaPushUserNamespace {
  /** This device's push subscription. */
  readonly pushSubscription: SallaPushSubscriptionNamespace;
  /** The external id of the current login; null for a guest. */
  getExternalId(): Promise<string | null>;
  /** Whether the last call was a login: it doesn't say whether the SallaPush server accepted the link. */
  isLoggedIn(): Promise<boolean>;
  /**
   * Adds or changes a tag on the server. Native trims and lowercases keys, which must then be 1 to 64 characters of
   * a-z, 0-9 and _; values are cut at 255 characters, and an empty value removes the tag. At most 100 tags.
   */
  addTag(key: string, value: string): void;
  /** Adds or changes several tags, by the rules of addTag. */
  addTags(tags: Record<string, string>): void;
  /** Removes a tag. */
  removeTag(key: string): void;
  /** Removes several tags. */
  removeTags(keys: string[]): void;
  /**
   * The device's tags, with your latest changes, also before they reach the server; right after a cold start, only
   * this launch's.
   */
  getTags(): Promise<Record<string, string>>;
  /** For example "ar"; null uses the device language. */
  setLanguage(language: string | null): void;
  /** Changes of the external id or the logged-in state, once native handled a login or logout. No replay. */
  addEventListener(
    event: 'change',
    listener: (state: SallaPushUserChangedState) => void
  ): SallaPushEventSubscription;
  /** Refusals of the current login, each once. There is no success event. */
  addEventListener(
    event: 'loginFailure',
    listener: (failure: SallaPushLoginFailure) => void
  ): SallaPushEventSubscription;
  /** Removes a 'change' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'change',
    listener: (state: SallaPushUserChangedState) => void
  ): void;
  /** Removes a 'loginFailure' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'loginFailure',
    listener: (failure: SallaPushLoginFailure) => void
  ): void;
}

/** This device's push subscription. */
export interface SallaPushSubscriptionNamespace {
  /** The SallaPush device id; null until the device has registered. */
  getId(): Promise<string | null>;
  /** The push token. It is private: never send it to analytics or logs. */
  getToken(): Promise<string | null>;
  /** Permission granted, not opted out, and a token. */
  getOptedIn(): Promise<boolean>;
  /** Clears an earlier opt-out, and shows the permission prompt while it can still show. */
  optIn(): void;
  /** Stops SallaPush notifications on this device until optIn(); the permission stays as it is. */
  optOut(): void;
  /**
   * Changes of the id, the token or the opted-in state. As with native observers, each listener added while the device
   * is registered first gets the current state once (previous equals current), whenever it is added.
   */
  addEventListener(
    event: 'change',
    listener: (state: SallaPushSubscriptionChangedState) => void
  ): SallaPushEventSubscription;
  /** Removes a 'change' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'change',
    listener: (state: SallaPushSubscriptionChangedState) => void
  ): void;
}

/** The notification permission, and helpers for notifications other SDKs handle. */
export interface SallaPushNotificationsNamespace {
  /** Whether notifications are allowed; on iOS false until native has read the permission, shortly after start. */
  getPermission(): Promise<boolean>;
  /** Whether the system can still show the permission prompt. */
  canRequestPermission(): Promise<boolean>;
  /** iOS only; null on Android. */
  getPermissionStatus(): Promise<SallaPushIOSPermissionStatus | null>;
  /** Asks for the permission; with fallbackToSettings, opens the app's notification settings when the prompt no longer shows. */
  requestPermission(fallbackToSettings?: boolean): Promise<boolean>;
  /** iOS only: quiet notifications without a prompt; false on Android. */
  registerForProvisionalAuthorization(): Promise<boolean>;
  /** Reads the permission again, after the app asked for it itself. */
  refreshPermission(): void;
  /** iOS only; does nothing on Android. */
  registerForRemoteNotifications(): void;
  /** iOS only: forwards the APNs token (hexadecimal text) another SDK holds, e.g. the `token` of `@capacitor-firebase/messaging`'s `'apnsTokenReceived'` event; does nothing on Android. */
  forwardApnsToken(apnsToken: string): void;
  /**
   * Removes the delivered SallaPush notifications only. On iOS it also sets the app icon's badge to 0 while
   * `autoUpdateBadge` is on; on Android the badge drops with the notifications.
   */
  clearAll(): void;
  /** Android only; does nothing on iOS. */
  removeNotification(androidNotificationId: number): void;
  /** Whether a payload another SDK received (an FCM data map, an APNs userInfo) is SallaPush's. */
  isSallaPushNotification(payload: Record<string, unknown>): Promise<boolean>;
  /** Android only: records `opened` for a notification another SDK (OneSignal) showed; false on iOS. */
  trackOpened(additionalData: Record<string, unknown> | null): Promise<boolean>;
  /**
   * Every tap. Taps made before the first click listener, such as the tap that launched the app, arrive a moment after
   * the first click listener is added, once, at every click listener added by then: add it at app start.
   */
  addEventListener(
    event: 'click',
    listener: (event: SallaPushClickEvent) => void
  ): SallaPushEventSubscription;
  /**
   * While a listener exists, every foreground SallaPush notification is held and offered here. Call
   * event.preventDefault() synchronously to keep it hidden; otherwise it is shown once the listeners return. On iOS it
   * is then shown as SallaPush's local copy, which has no image, no action buttons, no interruption level or relevance
   * score, and is not replaced by a later push with the same collapse id. Without a listener, the original is shown, so
   * add one only where the app decides per notification, such as a chat screen, and remove it when leaving.
   */
  addEventListener(
    event: 'foregroundWillDisplay',
    listener: (event: SallaPushWillDisplayEvent) => void
  ): SallaPushEventSubscription;
  /** Changes between allowed and not allowed. No replay. */
  addEventListener(
    event: 'permissionChange',
    listener: (permission: boolean) => void
  ): SallaPushEventSubscription;
  /** Removes a 'click' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'click',
    listener: (event: SallaPushClickEvent) => void
  ): void;
  /** Removes a 'foregroundWillDisplay' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'foregroundWillDisplay',
    listener: (event: SallaPushWillDisplayEvent) => void
  ): void;
  /** Removes a 'permissionChange' listener; the subscription's remove() does the same. */
  removeEventListener(
    event: 'permissionChange',
    listener: (permission: boolean) => void
  ): void;
}

/** SallaPush's console logs. */
export interface SallaPushDebugNamespace {
  /** The level SallaPush logs to the console at. */
  getLogLevel(): Promise<SallaPushLogLevel>;
  /** Sets the console level at run time; it overrides the configuration and the static key. */
  setLogLevel(level: SallaPushLogLevel): void;
  /**
   * One handler for the app: a new one replaces the previous one, and null removes it. It gets the entries at `level`
   * or more severe, whatever the console level; the first handler of the process also gets up to 100 earlier warnings
   * and errors. On iOS native has one handler per process, so this replaces a handler set from native code.
   */
  setLogHandler(
    level: SallaPushLogLevel,
    handler: ((entry: SallaPushLogEntry) => void) | null
  ): void;
}

/** Settings for apps that move from OneSignal. */
export interface SallaPushMigrationNamespace {
  /**
   * Android only; does nothing on iOS. Applies to this process only: for every process, set the meta-data
   * com.salla.push.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS instead.
   */
  setDisplayOneSignalCompatPayloads(display: boolean): void;
}
