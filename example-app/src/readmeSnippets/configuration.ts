import { SallaPush } from '@salla.sa/sallapush-capacitor';

// The README's "Consent", and the reference's "Initializing from JavaScript".

export function startWithAppIdKnownAtRunTime(appId: string): void {
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
