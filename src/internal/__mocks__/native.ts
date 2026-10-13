import { jest } from '@jest/globals';

import type { SallaPushNativePlugin } from '../native';

/** The native plugin for Jest: every method records its calls, and requests resolve native's defaults as `{ value }`. */
export const native = {
  getSdkVersion: jest.fn<SallaPushNativePlugin['getSdkVersion']>(() =>
    Promise.resolve({ value: '1.0.3' })
  ),
};
