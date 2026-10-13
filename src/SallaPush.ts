import { value } from './internal/calls';
import { native } from './internal/native';

/**
 * SallaPush for Capacitor. Every call is safe at any time, before or after initialization. On the web SallaPush isn't
 * available: requests reject with Capacitor's `UNIMPLEMENTED` error, and other calls print one console error each.
 */
export const SallaPush: {
  /** The native SallaPush SDK version on this platform, for example "1.0.2". */
  getSdkVersion(): Promise<string>;
} = {
  getSdkVersion: () => value(native.getSdkVersion()),
};
