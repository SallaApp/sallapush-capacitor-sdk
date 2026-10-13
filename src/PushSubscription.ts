import { nullable, send, value } from './internal/calls';
import { native } from './internal/native';
import type { SallaPushSubscriptionNamespace } from './definitions';

export const PushSubscription: Omit<
  SallaPushSubscriptionNamespace,
  'addEventListener' | 'removeEventListener'
> = {
  getId: () => nullable(native.getPushSubscriptionId()),
  getToken: () => nullable(native.getPushSubscriptionToken()),
  getOptedIn: () => value(native.getPushSubscriptionOptedIn()),
  optIn: () =>
    send('SallaPush.User.pushSubscription.optIn', () => native.optIn()),
  optOut: () =>
    send('SallaPush.User.pushSubscription.optOut', () => native.optOut()),
};
