import { CapacitorException, ExceptionCode } from '@capacitor/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { native } from '../internal/native';
import { SallaPush } from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
const subscription = SallaPush.User.pushSubscription;
let error: jest.SpiedFunction<typeof console.error>;

/** Lets the rejections of sent calls reach their handlers. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

describe('SallaPush.User.pushSubscription', () => {
  it('is one namespace for the app', () => {
    expect(SallaPush.User.pushSubscription).toBe(subscription);
  });

  it('resolves the subscription native reads at call time', async () => {
    plugin.getPushSubscriptionId.mockResolvedValueOnce({
      value: '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40',
    });
    plugin.getPushSubscriptionToken.mockResolvedValueOnce({ value: 'a1b2c3' });
    plugin.getPushSubscriptionOptedIn.mockResolvedValueOnce({ value: true });

    await expect(subscription.getId()).resolves.toBe(
      '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40'
    );
    await expect(subscription.getToken()).resolves.toBe('a1b2c3');
    await expect(subscription.getOptedIn()).resolves.toBe(true);
  });

  it('resolves an unregistered device as native reads it', async () => {
    await expect(subscription.getId()).resolves.toBeNull();
    await expect(subscription.getToken()).resolves.toBeNull();
    await expect(subscription.getOptedIn()).resolves.toBe(false);
  });

  it('passes optIn and optOut', () => {
    subscription.optIn();
    subscription.optOut();

    expect(plugin.optIn).toHaveBeenCalledTimes(1);
    expect(plugin.optOut).toHaveBeenCalledTimes(1);
    expect(plugin.optIn.mock.invocationCallOrder[0]).toBeLessThan(
      plugin.optOut.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('reports a missing native plugin once per method', async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.optOut.mockRejectedValueOnce(missing);
    plugin.getPushSubscriptionToken.mockRejectedValueOnce(missing);

    subscription.optOut();
    await expect(subscription.getToken()).rejects.toBe(missing);
    await flush();

    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.User.pushSubscription.optOut failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
  });
});
