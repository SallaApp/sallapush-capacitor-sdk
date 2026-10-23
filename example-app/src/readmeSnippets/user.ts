import { SallaPush } from '@salla.sa/sallapush-capacitor';

// The README's "Login and logout" and "Tags and language".

export function signInAndOut(externalId: string, identityToken: string): void {
  // snippet:login-logout
  // After the customer signs in, and at each app launch while they are signed in:
  SallaPush.login(externalId, identityToken);

  // After the customer signs out:
  SallaPush.logout();
  // end-snippet
}

export function cartChanged(total: number, items: number): void {
  // snippet:tags
  SallaPush.User.addTag('add_to_cart', String(Math.floor(Date.now() / 1000)));
  SallaPush.User.addTags({
    total_cart_amount: String(total),
    cart_items: String(items),
  });
  // end-snippet
}
