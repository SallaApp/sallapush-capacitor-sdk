/**
 * Sends a call nobody awaits: the public API's void methods. Only a missing native plugin (the web, or an app built
 * without npx cap sync) makes it fail, which is reported once per method; native itself never fails a call.
 */
export declare function send(method: string, call: () => Promise<unknown>): void;
/** The value of a request. A missing native plugin rejects it with Capacitor's UNIMPLEMENTED error, as it should. */
export declare function value<T>(result: Promise<{
    value: T;
}>): Promise<T>;
/** The value of a request whose native answer may be null or absent. */
export declare function nullable<T>(result: Promise<{
    value?: T | null;
}>): Promise<T | null>;
/** One console error per method: "[SallaPush] SallaPush.login failed: "SallaPush" plugin is not implemented on web". */
export declare function reportFailure(method: string, error: unknown): void;
