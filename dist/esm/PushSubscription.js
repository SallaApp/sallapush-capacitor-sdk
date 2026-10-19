import { SubscriptionHub, addListener, removeListener, } from './internal/EventHub';
import { nullable, send, value } from './internal/calls';
import { native } from './internal/native';
const hubs = { change: new SubscriptionHub() };
export const PushSubscription = {
    getId: () => nullable(native.getPushSubscriptionId()),
    getToken: () => nullable(native.getPushSubscriptionToken()),
    getOptedIn: () => value(native.getPushSubscriptionOptedIn()),
    optIn: () => send('SallaPush.User.pushSubscription.optIn', () => native.optIn()),
    optOut: () => send('SallaPush.User.pushSubscription.optOut', () => native.optOut()),
    addEventListener: (event, listener) => addListener('SallaPush.User.pushSubscription.addEventListener', hubs, event, listener),
    removeEventListener: (event, listener) => removeListener('SallaPush.User.pushSubscription.removeEventListener', hubs, event, listener),
};
//# sourceMappingURL=PushSubscription.js.map