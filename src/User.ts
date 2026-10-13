import { PushSubscription } from './PushSubscription';
import { nullable as valueOrNull, send, value } from './internal/calls';
import { native } from './internal/native';
import { array, nullable, record, string, valid } from './internal/validate';
import type { SallaPushUserNamespace } from './definitions';

// The entries of addTags and removeTags go to native unchecked: native skips and logs the ones that aren't strings.
export const User: Omit<
  SallaPushUserNamespace,
  'pushSubscription' | 'addEventListener' | 'removeEventListener'
> & { readonly pushSubscription: typeof PushSubscription } = {
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
};
