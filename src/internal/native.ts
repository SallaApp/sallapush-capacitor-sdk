import { registerPlugin } from '@capacitor/core';

export type Value<T> = { value: T };

export interface SallaPushNativePlugin {
  getSdkVersion(): Promise<Value<string>>;
}

/**
 * The native SallaPush plugin. On a platform without it (the web, or an app that wasn't synced with npx cap sync)
 * every call rejects with Capacitor's UNIMPLEMENTED error.
 */
export const native = registerPlugin<SallaPushNativePlugin>('SallaPush');
