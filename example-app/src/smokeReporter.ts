import { registerPlugin } from '@capacitor/core';

/**
 * The example's own native plugin, for the smoke tests; never copy it into an app. It writes a self-test line to the
 * native log, where the smoke tests read it: the unified log on iOS (subsystem sa.salla.sallapush.example, category
 * smoke) and Logcat on Android (tag SallaPushSmoke). Release builds don't forward the console to native logs.
 */
export const SmokeReporter = registerPlugin<{
  report(options: { line: string }): Promise<void>;
}>('SmokeReporter');
