import { PushSubscription } from './PushSubscription';
import { EventHub, addListener, removeListener } from './internal/EventHub';
import { nullable as valueOrNull, send, value } from './internal/calls';
import { loginFailure, userChange } from './internal/mapping';
import { native } from './internal/native';
import { array, nullable, record, string, valid } from './internal/validate';
import type { SallaPushUserNamespace } from './definitions';

const hubs = {
  change: new EventHub({
    kind: 'user',
    name: "SallaPush.User 'change' listener",
    connect: (dispatch) => native.addListener('userChange', dispatch),
    map: userChange,
  }),
  loginFailure: new EventHub({
    kind: 'loginFailure',
    name: "SallaPush.User 'loginFailure' listener",
    connect: (dispatch) => native.addListener('loginFailure', dispatch),
    map: loginFailure,
  }),
};

// The entries of addTags and removeTags go to native unchecked: native skips and logs the ones that aren't strings.
export const User: SallaPushUserNamespace = {
  pushSubscription: PushSubscription,
  getExternalId: () => valueOrNull(native.getExternalId()),
  isLoggedIn: () => value(native.isLoggedIn()),
  addTag(key, value) {
    if (
      valid('SallaPush.User.addTag', {
        key: [key, string],
        value: [value, string],
      })
    ) {
      send('SallaPush.User.addTag', () => native.addTag({ key, value }));
    }
  },
  addTags(tags) {
    if (valid('SallaPush.User.addTags', { tags: [tags, record] })) {
      send('SallaPush.User.addTags', () => native.addTags({ tags }));
    }
  },
  removeTag(key) {
    if (valid('SallaPush.User.removeTag', { key: [key, string] })) {
      send('SallaPush.User.removeTag', () => native.removeTag({ key }));
    }
  },
  removeTags(keys) {
    if (valid('SallaPush.User.removeTags', { keys: [keys, array] })) {
      send('SallaPush.User.removeTags', () => native.removeTags({ keys }));
    }
  },
  getTags: () => value(native.getTags()),
  setLanguage(language) {
    if (
      valid('SallaPush.User.setLanguage', {
        language: [language, nullable(string)],
      })
    ) {
      send('SallaPush.User.setLanguage', () =>
        native.setLanguage({ language })
      );
    }
  },
  addEventListener: (event: unknown, listener: unknown) =>
    addListener('SallaPush.User.addEventListener', hubs, event, listener),
  removeEventListener: (event: unknown, listener: unknown) =>
    removeListener('SallaPush.User.removeEventListener', hubs, event, listener),
};
