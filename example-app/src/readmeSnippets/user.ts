import {
  SallaPush,
  type SallaPushEventSubscription,
} from '@salla.sa/sallapush-capacitor';
import { settingsScreen, telemetry } from './standIns';

// README "Tags, language and the push subscription" and "Identity".

export function cartChanged(total: number, items: number): void {
  // snippet:tags
  SallaPush.User.addTag('add_to_cart', String(Math.floor(Date.now() / 1000)));
  SallaPush.User.addTags({
    total_cart_amount: String(total),
    cart_items: String(items),
  });
  // end-snippet
}

export function cartEmptied(): void {
  // snippet:remove-tags
  SallaPush.User.removeTags(['total_cart_amount', 'cart_items']);
  // end-snippet
}

export function languageChanged(code: string): void {
  // snippet:language
  SallaPush.User.setLanguage(code);
  // end-snippet
}

export function pushToggleChanged(isOn: boolean): void {
  // snippet:opt-out
  if (isOn) {
    SallaPush.User.pushSubscription.optIn();
  } else {
    SallaPush.User.pushSubscription.optOut();
  }
  // end-snippet
}

export function showDeviceInSettings(): SallaPushEventSubscription {
  // snippet:subscription-listener
  const subscription = SallaPush.User.pushSubscription.addEventListener(
    'change',
    ({ current }) => {
      settingsScreen.showDevice(current.id, current.optedIn);
    }
  );
  // end-snippet
  return subscription;
}

export function watchLoginFailures(): void {
  // snippet:login-failures
  SallaPush.User.addEventListener('loginFailure', (failure) => {
    // tokenRejected: log in again once the app has a current token, never from here.
    // invalidRequest: push-service refused the request as invalid; tell the Salla team.
    telemetry.report('sallapush', `login_${failure}`, 'Login refused', {});
  });
  // end-snippet
}
