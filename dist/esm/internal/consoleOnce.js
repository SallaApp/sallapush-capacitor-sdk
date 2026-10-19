/** Where the wrapper's own JavaScript lines go: the app's console, which is the WebView console. */
const output = console;
const reported = new Set();
/** Writes a `[SallaPush]` warning the first time `key` comes up in this JavaScript runtime. */
export function warnOnce(key, message) {
    if (reported.has(key)) {
        return;
    }
    reported.add(key);
    output.warn(`[SallaPush] ${message}`);
}
/** Writes a `[SallaPush]` error the first time `key` comes up in this JavaScript runtime. */
export function errorOnce(key, message) {
    if (reported.has(key)) {
        return;
    }
    reported.add(key);
    output.error(`[SallaPush] ${message}`);
}
//# sourceMappingURL=consoleOnce.js.map