import { CapacitorException, ExceptionCode } from '@capacitor/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type * as NativeMock from '../internal/__mocks__/native';
import { native, type SubscriptionStateSpec } from '../internal/native';
import {
  SallaPush,
  type SallaPushEventSubscription,
  type SallaPushSubscriptionChangedState,
} from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
const { emit, flush } =
  jest.requireMock<typeof NativeMock>('../internal/native');
const subscription = SallaPush.User.pushSubscription;
const subscriptions: SallaPushEventSubscription[] = [];
let error: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  jest.clearAllMocks();
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  for (const added of subscriptions.splice(0)) {
    added.remove();
  }
  await flush();
  error.mockRestore();
});

type Listener = jest.Mock<(state: SallaPushSubscriptionChangedState) => void>;

function listen(listener: Listener = jest.fn()): Listener {
  subscriptions.push(subscription.addEventListener('change', listener));
  return listener;
}

/** The id the n-th listener added in this test registered natively. */
function idOf(index: number): number {
  return (
    plugin.addPushSubscriptionListener.mock.calls[index]?.[0].listenerId ?? -1
  );
}

const unregistered: SubscriptionStateSpec = { optedIn: false };
const registered: SubscriptionStateSpec = {
  id: '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40',
  token: 'a1b2c3',
  optedIn: true,
};

/** Emits what the native observer of `listenerId` reports. */
function emitChange(
  listenerId: number,
  previous: SubscriptionStateSpec,
  current: SubscriptionStateSpec
): void {
  emit('pushSubscriptionChange', { listenerId, previous, current });
}

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

describe('SallaPush.User.pushSubscription change listeners', () => {
  it('each register their own native observer, with the next id', async () => {
    listen();
    listen();
    await flush();

    expect(plugin.addPushSubscriptionListener).toHaveBeenCalledTimes(2);
    expect(idOf(1)).toBe(idOf(0) + 1);
    expect(plugin.startEvents).not.toHaveBeenCalled();
  });

  it('get only the events their own native observer reports', async () => {
    const first = listen();
    const second = listen();
    await flush();

    emitChange(idOf(1), unregistered, registered);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({
      previous: { id: null, token: null, optedIn: false },
      current: {
        id: '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40',
        token: 'a1b2c3',
        optedIn: true,
      },
    });
  });

  it('each get their own replay: a listener added later gets one, the earlier one none', async () => {
    const first = listen();
    await flush();
    emitChange(idOf(0), registered, registered);
    const second = listen();
    await flush();
    emitChange(idOf(1), registered, registered);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0]?.[0].previous).toEqual(
      second.mock.calls[0]?.[0].current
    );
  });

  it('register the same function once', async () => {
    const listener = listen();
    listen(listener);
    await flush();

    emitChange(idOf(0), unregistered, registered);

    expect(plugin.addPushSubscriptionListener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('remove only their own native observer', async () => {
    const first = subscription.addEventListener('change', jest.fn());
    const second =
      jest.fn<(state: SallaPushSubscriptionChangedState) => void>();
    subscription.addEventListener('change', second);
    await flush();

    first.remove();
    await flush();
    expect(plugin.removePushSubscriptionListener.mock.calls).toEqual([
      [{ listenerId: idOf(0) }],
    ]);

    subscription.removeEventListener('change', second);
    await flush();
    expect(plugin.removePushSubscriptionListener.mock.calls).toEqual([
      [{ listenerId: idOf(0) }],
      [{ listenerId: idOf(1) }],
    ]);
  });

  it('drop an event for a listener already removed', async () => {
    const removed =
      jest.fn<(state: SallaPushSubscriptionChangedState) => void>();
    const kept = listen();
    subscription.addEventListener('change', removed).remove();
    await flush();

    emitChange(idOf(1), unregistered, registered);

    expect(removed).not.toHaveBeenCalled();
    expect(kept).not.toHaveBeenCalled();
  });

  it('register again after the last removal, with new ids', async () => {
    subscription.addEventListener('change', jest.fn()).remove();
    listen();
    await flush();

    expect(idOf(1)).toBe(idOf(0) + 1);
    expect(plugin.removePushSubscriptionListener.mock.calls).toEqual([
      [{ listenerId: idOf(0) }],
    ]);
  });

  it('report a listener that throws', async () => {
    const failure = new Error('listener failed');
    listen(
      jest.fn(() => {
        throw failure;
      })
    );
    await flush();

    emitChange(idOf(0), unregistered, registered);

    expect(error).toHaveBeenCalledWith(
      "[SallaPush] A SallaPush.User.pushSubscription 'change' listener threw:",
      failure
    );
  });
});
