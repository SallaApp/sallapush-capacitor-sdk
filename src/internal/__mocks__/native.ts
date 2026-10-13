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
};
