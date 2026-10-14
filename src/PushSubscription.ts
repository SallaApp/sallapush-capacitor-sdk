import {
  SubscriptionHub,
  addListener,
  removeListener,
} from './internal/EventHub';
import { nullable, send, value } from './internal/calls';
import { native } from './internal/native';
import type { SallaPushSubscriptionNamespace } from './definitions';

const hubs = { change: new SubscriptionHub() };

export const PushSubscription: SallaPushSubscriptionNamespace = {
  getId: () => nullable(native.getPushSubscriptionId()),
  getToken: () => nullable(native.getPushSubscriptionToken()),
  getOptedIn: () => value(native.getPushSubscriptionOptedIn()),
  optIn: () =>
    send('SallaPush.User.pushSubscription.optIn', () => native.optIn()),
  optOut: () =>
    send('SallaPush.User.pushSubscription.optOut', () => native.optOut()),
  addEventListener: (event: unknown, listener: unknown) =>
    addListener(
      'SallaPush.User.pushSubscription.addEventListener',
      hubs,
      event,
      listener
    ),
  removeEventListener: (event: unknown, listener: unknown) =>
    removeListener(
      'SallaPush.User.pushSubscription.removeEventListener',
      hubs,
      event,
      listener
    ),
};
