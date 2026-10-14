import { errorOnce } from './consoleOnce';

/**
 * Sends a call nobody awaits: the public API's void methods. Only a missing native plugin (the web, or an app built
 * without npx cap sync) makes it fail, which is reported once per method; native itself never fails a call.
 */
export function send(method: string, call: () => Promise<unknown>): void {
  try {
    call().catch((error: unknown) => reportFailure(method, error));
  } catch (error) {
    reportFailure(method, error);
  }
}

/** The value of a request. A missing native plugin rejects it with Capacitor's UNIMPLEMENTED error, as it should. */
export async function value<T>(result: Promise<{ value: T }>): Promise<T> {
  return (await result).value;
}

/** The value of a request whose native answer may be null or absent. */
export async function nullable<T>(
  result: Promise<{ value?: T | null }>
): Promise<T | null> {
  return (await result).value ?? null;
}

/** One console error per method: "[SallaPush] SallaPush.login failed: "SallaPush" plugin is not implemented on web". */
export function reportFailure(method: string, error: unknown): void {
  errorOnce(
    `call:${method}`,
    `${method} failed: ${error instanceof Error ? error.message : String(error)}`
  );
}
