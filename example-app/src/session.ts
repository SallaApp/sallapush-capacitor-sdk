import { SallaPush } from '@salla.sa/sallapush-capacitor';

/** A signed-in customer: the app's id for them, and the identity token Salla issued for that id. */
export type Customer = { externalId: string; identityToken: string };

// The example's stand-in for the app's session. It lives in memory only, so every launch starts signed out.
let customer: Customer | null = null;

export function currentCustomer(): Customer | null {
  return customer;
}

// snippet:sign-in-out
export function customerDidSignIn(signedIn: Customer): void {
  customer = signedIn;
  SallaPush.login(signedIn.externalId, signedIn.identityToken);
}

export function customerDidSignOut(): void {
  customer = null;
  SallaPush.logout();
}
// end-snippet
