import { jest } from '@jest/globals';

import type { SallaPushNativePlugin } from '../native';

/**
 * The native plugin for Jest: every method records its calls; requests resolve native's defaults as `{ value }`, and
 * the other methods resolve nothing.
 */
export const native = {
  initialize: jest.fn<SallaPushNativePlugin['initialize']>(() =>
    Promise.resolve()
  ),
  isInitialized: jest.fn<SallaPushNativePlugin['isInitialized']>(() =>
    Promise.resolve({ value: false })
  ),
  getSallaPushAppId: jest.fn<SallaPushNativePlugin['getSallaPushAppId']>(() =>
    Promise.resolve({ value: null })
  ),
  getSdkVersion: jest.fn<SallaPushNativePlugin['getSdkVersion']>(() =>
    Promise.resolve({ value: '1.0.3' })
  ),
  setConsentRequired: jest.fn<SallaPushNativePlugin['setConsentRequired']>(() =>
    Promise.resolve()
  ),
  setConsentGiven: jest.fn<SallaPushNativePlugin['setConsentGiven']>(() =>
    Promise.resolve()
  ),
  login: jest.fn<SallaPushNativePlugin['login']>(() => Promise.resolve()),
  logout: jest.fn<SallaPushNativePlugin['logout']>(() => Promise.resolve()),

  getExternalId: jest.fn<SallaPushNativePlugin['getExternalId']>(() =>
    Promise.resolve({ value: null })
  ),
  isLoggedIn: jest.fn<SallaPushNativePlugin['isLoggedIn']>(() =>
    Promise.resolve({ value: false })
  ),
  addTag: jest.fn<SallaPushNativePlugin['addTag']>(() => Promise.resolve()),
  addTags: jest.fn<SallaPushNativePlugin['addTags']>(() => Promise.resolve()),
  removeTag: jest.fn<SallaPushNativePlugin['removeTag']>(() =>
    Promise.resolve()
  ),
  removeTags: jest.fn<SallaPushNativePlugin['removeTags']>(() =>
    Promise.resolve()
  ),
  getTags: jest.fn<SallaPushNativePlugin['getTags']>(() =>
    Promise.resolve({ value: {} })
  ),
  setLanguage: jest.fn<SallaPushNativePlugin['setLanguage']>(() =>
    Promise.resolve()
  ),

  getPushSubscriptionId: jest.fn<
    SallaPushNativePlugin['getPushSubscriptionId']
  >(() => Promise.resolve({ value: null })),
  getPushSubscriptionToken: jest.fn<
    SallaPushNativePlugin['getPushSubscriptionToken']
  >(() => Promise.resolve({ value: null })),
  getPushSubscriptionOptedIn: jest.fn<
    SallaPushNativePlugin['getPushSubscriptionOptedIn']
  >(() => Promise.resolve({ value: false })),
  optIn: jest.fn<SallaPushNativePlugin['optIn']>(() => Promise.resolve()),
  optOut: jest.fn<SallaPushNativePlugin['optOut']>(() => Promise.resolve()),

  getPermission: jest.fn<SallaPushNativePlugin['getPermission']>(() =>
    Promise.resolve({ value: false })
  ),
  canRequestPermission: jest.fn<SallaPushNativePlugin['canRequestPermission']>(
    () => Promise.resolve({ value: false })
  ),
  getPermissionStatus: jest.fn<SallaPushNativePlugin['getPermissionStatus']>(
    () => Promise.resolve({ value: null })
  ),
  requestPermission: jest.fn<SallaPushNativePlugin['requestPermission']>(() =>
    Promise.resolve({ value: false })
  ),
  registerForProvisionalAuthorization: jest.fn<
    SallaPushNativePlugin['registerForProvisionalAuthorization']
  >(() => Promise.resolve({ value: false })),
  refreshPermission: jest.fn<SallaPushNativePlugin['refreshPermission']>(() =>
    Promise.resolve()
  ),
  registerForRemoteNotifications: jest.fn<
    SallaPushNativePlugin['registerForRemoteNotifications']
  >(() => Promise.resolve()),
  forwardApnsToken: jest.fn<SallaPushNativePlugin['forwardApnsToken']>(() =>
    Promise.resolve()
  ),
  clearAll: jest.fn<SallaPushNativePlugin['clearAll']>(() => Promise.resolve()),
  removeNotification: jest.fn<SallaPushNativePlugin['removeNotification']>(() =>
    Promise.resolve()
  ),
  isSallaPushNotification: jest.fn<
    SallaPushNativePlugin['isSallaPushNotification']
  >(() => Promise.resolve({ value: false })),
  trackOpened: jest.fn<SallaPushNativePlugin['trackOpened']>(() =>
    Promise.resolve({ value: false })
  ),
};
