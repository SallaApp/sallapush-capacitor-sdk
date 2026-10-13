/** Where the wrapper's own JavaScript lines go: the app's console, which is the WebView console. */
const output: Pick<Console, 'warn' | 'error'> = console;

const reported = new Set<string>();

/** Writes a `[SallaPush]` warning the first time `key` comes up in this JavaScript runtime. */
export function warnOnce(key: string, message: string): void {
  if (reported.has(key)) {
    return;
  }
  reported.add(key);
  output.warn(`[SallaPush] ${message}`);
}

/** Writes a `[SallaPush]` error the first time `key` comes up in this JavaScript runtime. */
export function errorOnce(key: string, message: string): void {
  if (reported.has(key)) {
    return;
  }
  reported.add(key);
  output.error(`[SallaPush] ${message}`);
}
