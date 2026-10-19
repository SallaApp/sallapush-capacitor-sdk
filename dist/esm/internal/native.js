import { registerPlugin } from '@capacitor/core';
/**
 * The native SallaPush plugin. On a platform without it (the web, or an app that wasn't synced with npx cap sync)
 * every call rejects with Capacitor's UNIMPLEMENTED error.
 */
export const native = registerPlugin('SallaPush');
//# sourceMappingURL=native.js.map