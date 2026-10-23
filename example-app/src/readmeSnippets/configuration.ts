import { SallaPush, SallaPushLogLevel } from '@salla.sa/sallapush-capacitor';
import { telemetry } from './standIns';

// The README's and the setup guide's "Consent" and "Logging", and the setup guide's "Initializing from JavaScript".

export function startWithAppIdFromServer(appId: string): void {
  // snippet:initialize
  SallaPush.initialize(appId, {
    ios: { appGroupIdentifier: 'group.com.example.shop' },
  });
  // end-snippet
}

export function startWithConsentRequired(appId: string): void {
  // snippet:consent-required
  SallaPush.setConsentRequired(true);
  SallaPush.initialize(appId);
  // end-snippet
}

// snippet:consent-given
export function privacyChoiceChanged(allowsNotifications: boolean): void {
  SallaPush.setConsentGiven(allowsNotifications);
}
// end-snippet

export function enableVerboseLogs(): void {
  // snippet:log-level
  SallaPush.Debug.setLogLevel(SallaPushLogLevel.Verbose);
  // end-snippet
}

export function forwardErrors(): void {
  // snippet:log-handler
  SallaPush.Debug.setLogHandler(SallaPushLogLevel.Error, (entry) => {
    telemetry.report('sallapush', entry.code, entry.message, entry.metadata);
  });
  // end-snippet
}
