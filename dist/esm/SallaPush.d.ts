import type { SallaPushConfig, SallaPushDebugNamespace, SallaPushMigrationNamespace, SallaPushNotificationsNamespace, SallaPushUserNamespace } from './definitions';
/**
 * SallaPush for Capacitor. Every call is safe at any time, before or after initialization. On the web SallaPush isn't
 * available: requests reject with Capacitor's `UNIMPLEMENTED` error, and other calls print one console error each.
 */
export declare const SallaPush: {
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
    readonly User: SallaPushUserNamespace;
    readonly Notifications: SallaPushNotificationsNamespace;
    readonly Debug: SallaPushDebugNamespace;
    readonly Migration: SallaPushMigrationNamespace;
};
