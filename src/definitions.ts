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
   * push-service refused the token for this external id: it expired, was revoked or is another customer's, it has a
   * Bearer prefix, or Salla couldn't check it. Call login again when the app next refreshes the token or at the next
   * launch, never from the loginFailure listener.
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
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly body: string | null;
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
  readonly source: SallaPushPayloadSource;
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
  readonly notification: SallaPushNotification;
  readonly result: SallaPushClickResult;
}

/** A SallaPush notification about to be shown while the app is in the foreground. */
export interface SallaPushWillDisplayEvent {
  readonly notification: SallaPushNotification;
  readonly isPrevented: boolean;
  /**
   * Keeps the notification hidden. It counts only when called before the listener returns, so call it before any
   * await. A prevented notification can be shown later with notification.display().
   */
  preventDefault(): void;
}

/** The push subscription at one moment. */
export interface SallaPushSubscriptionState {
  readonly id: string | null;
  /** The push token. It is private: never send it to analytics or logs. */
  readonly token: string | null;
  readonly optedIn: boolean;
}

/** A change of the push subscription. */
export interface SallaPushSubscriptionChangedState {
  readonly previous: SallaPushSubscriptionState;
  readonly current: SallaPushSubscriptionState;
}

/** The customer this device is logged in for, at one moment. */
export interface SallaPushUserState {
  readonly externalId: string | null;
  readonly isLoggedIn: boolean;
}

/** A change of the customer login. */
export interface SallaPushUserChangedState {
  readonly previous: SallaPushUserState;
  readonly current: SallaPushUserState;
}

/**
 * One SallaPush log entry. Its fields are redacted by native: no secret or identity token. On iOS, the info entries
 * `status.launch` and `status.changed` hold the full push token and the customer's id: don't forward info entries to
 * third parties.
 */
export interface SallaPushLogEntry {
  readonly level: SallaPushLogLevel;
  /** The area: lifecycle, registration, identity, notifications, events, tags, network, storage, consent. */
  readonly category: string;
  /** A stable code, such as register.ok. */
  readonly code: string;
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
  apiBaseUrl?: string;
  logLevel?: SallaPushLogLevel;
  appVersion?: string;
  clearTagsOnLogout?: boolean;
  requiresUserConsent?: boolean;
  /** SallaPush opens https launch URLs on tap. The click listener still gets the tap: it must not open the URL again. */
  openLaunchUrls?: boolean;
  /** iOS only; ignored on Android. */
  ios?: {
    appGroupIdentifier?: string;
    apnsEnvironment?: SallaPushAPNsEnvironment;
    autoClearBadge?: boolean;
    registerForRemoteNotificationsOnInit?: boolean;
  };
}

/** The customer, and this device's tags and language. */
export interface SallaPushUserNamespace {
  readonly pushSubscription: SallaPushSubscriptionNamespace;
  /** The external id of the current login; null for a guest. */
  getExternalId(): Promise<string | null>;
  isLoggedIn(): Promise<boolean>;
  /** Native trims and lowercases keys; an empty value removes the tag. */
  addTag(key: string, value: string): void;
  addTags(tags: Record<string, string>): void;
  removeTag(key: string): void;
  removeTags(keys: string[]): void;
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
  removeEventListener(
    event: 'change',
    listener: (state: SallaPushUserChangedState) => void
  ): void;
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
  optOut(): void;
  /**
   * Changes of the id, the token or the opted-in state. As with native observers, each listener added while the device
   * is registered first gets the current state once (previous equals current), whenever it is added.
   */
  addEventListener(
    event: 'change',
    listener: (state: SallaPushSubscriptionChangedState) => void
  ): SallaPushEventSubscription;
  removeEventListener(
    event: 'change',
    listener: (state: SallaPushSubscriptionChangedState) => void
  ): void;
}

/** The notification permission, and helpers for notifications other SDKs handle. */
export interface SallaPushNotificationsNamespace {
  /** Whether notifications are allowed; on iOS false until native has read the permission, shortly after start. */
  getPermission(): Promise<boolean>;
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
  /** Removes the delivered SallaPush notifications only. */
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
  removeEventListener(
    event: 'click',
    listener: (event: SallaPushClickEvent) => void
  ): void;
  removeEventListener(
    event: 'foregroundWillDisplay',
    listener: (event: SallaPushWillDisplayEvent) => void
  ): void;
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
