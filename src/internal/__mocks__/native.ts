import { jest } from '@jest/globals';

import type { SallaPushNativePlugin } from '../native';

/** A Capacitor listener's handle. The hubs keep theirs for the page's lifetime, so remove() is never expected. */
type Handle = { remove: jest.Mock<() => Promise<void>> };

/**
 * The Capacitor listeners added in this module registry, as Capacitor keeps them for a page: jest.clearAllMocks()
 * forgets addListener's calls, not these.
 */
const listeners: { eventName: string; listener: (payload: never) => void }[] =
  [];

/**
 * The native plugin for Jest: every method records its calls; requests resolve native's defaults as `{ value }`, and
 * the other methods resolve nothing. addListener keeps each Capacitor listener for emit().
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
  addPushSubscriptionListener: jest.fn<
    SallaPushNativePlugin['addPushSubscriptionListener']
  >(() => Promise.resolve()),
  removePushSubscriptionListener: jest.fn<
    SallaPushNativePlugin['removePushSubscriptionListener']
  >(() => Promise.resolve()),

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
  displayNotification: jest.fn<SallaPushNativePlugin['displayNotification']>(
    () => Promise.resolve()
  ),

  setDisplayOneSignalCompatPayloads: jest.fn<
    SallaPushNativePlugin['setDisplayOneSignalCompatPayloads']
  >(() => Promise.resolve()),

  getLogLevel: jest.fn<SallaPushNativePlugin['getLogLevel']>(() =>
    Promise.resolve({ value: 'warn' })
  ),
  setLogLevel: jest.fn<SallaPushNativePlugin['setLogLevel']>(() =>
    Promise.resolve()
  ),

  startEvents: jest.fn<SallaPushNativePlugin['startEvents']>(() =>
    Promise.resolve()
  ),
  stopEvents: jest.fn<SallaPushNativePlugin['stopEvents']>(() =>
    Promise.resolve()
  ),

  addListener: jest.fn(
    (
      eventName: string,
      listener: (payload: never) => void
    ): Promise<Handle> => {
      listeners.push({ eventName, listener });
      return Promise.resolve({ remove: jest.fn(async () => {}) });
    }
  ),
};

/** Sends an event to the Capacitor listeners added for it, as the native plugin's notifyListeners does. */
export function emit(eventName: string, payload: unknown): void {
  for (const added of listeners) {
    if (added.eventName === eventName) {
      (added.listener as (payload: unknown) => void)(payload);
    }
  }
}

/** Lets the hubs' native steps, and the rejections of sent calls, run to their end. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
