/** SallaPush's log levels, from the quietest. */
export const SallaPushLogLevel = {
    Off: 'off',
    Error: 'error',
    Warn: 'warn',
    Info: 'info',
    Debug: 'debug',
    Verbose: 'verbose',
};
/** The APNs environment SallaPush registers the iOS device token for. */
export const SallaPushAPNsEnvironment = {
    Automatic: 'automatic',
    Sandbox: 'sandbox',
    Production: 'production',
};
/** iOS's notification authorization status. */
export const SallaPushIOSPermissionStatus = {
    NotDetermined: 'notDetermined',
    Denied: 'denied',
    Authorized: 'authorized',
    Provisional: 'provisional',
    Ephemeral: 'ephemeral',
};
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
};
/** The format a notification arrived in: SallaPush's own, or the OneSignal-compatible one used while apps migrate. */
export const SallaPushPayloadSource = {
    Native: 'native',
    Compat: 'compat',
};
//# sourceMappingURL=definitions.js.map