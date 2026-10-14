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
import { native } from '../internal/native';
import {
  SallaPush,
  SallaPushIOSPermissionStatus,
  SallaPushPayloadSource,
  type SallaPushClickEvent,
  type SallaPushEventSubscription,
} from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
const { emit, flush } =
  jest.requireMock<typeof NativeMock>('../internal/native');
const notifications = SallaPush.Notifications;
const subscriptions: SallaPushEventSubscription[] = [];
let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  for (const subscription of subscriptions.splice(0)) {
    subscription.remove();
  }
  await flush();
  warn.mockRestore();
  error.mockRestore();
});

describe('SallaPush.Notifications permission', () => {
  it('resolves the permission native reads at call time', async () => {
    plugin.getPermission.mockResolvedValueOnce({ value: true });
    plugin.canRequestPermission.mockResolvedValueOnce({ value: true });

    await expect(notifications.getPermission()).resolves.toBe(true);
    await expect(notifications.canRequestPermission()).resolves.toBe(true);
  });

  it.each(Object.values(SallaPushIOSPermissionStatus))(
    'resolves the iOS status %s',
    async (status) => {
      plugin.getPermissionStatus.mockResolvedValueOnce({ value: status });

      await expect(notifications.getPermissionStatus()).resolves.toBe(status);
    }
  );

  it('resolves a null status on Android', async () => {
    await expect(notifications.getPermissionStatus()).resolves.toBeNull();
  });

  it('requests the permission without the settings fallback by default', async () => {
    plugin.requestPermission.mockResolvedValueOnce({ value: true });

    await expect(notifications.requestPermission()).resolves.toBe(true);
    expect(plugin.requestPermission).toHaveBeenCalledWith({
      fallbackToSettings: false,
    });
  });

  it('requests the permission with the settings fallback', async () => {
    await expect(notifications.requestPermission(true)).resolves.toBe(false);
    expect(plugin.requestPermission).toHaveBeenCalledWith({
      fallbackToSettings: true,
    });
  });

  it('resolves false for a request whose fallback is not a boolean', async () => {
    await expect(
      notifications.requestPermission('yes' as unknown as boolean)
    ).resolves.toBe(false);

    expect(plugin.requestPermission).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Notifications.requestPermission ignored: fallbackToSettings must be a boolean.'
    );
  });

  it('resolves the provisional authorization native gives', async () => {
    plugin.registerForProvisionalAuthorization.mockResolvedValueOnce({
      value: true,
    });

    await expect(
      notifications.registerForProvisionalAuthorization()
    ).resolves.toBe(true);
  });

  it('passes refreshPermission, registerForRemoteNotifications and clearAll', () => {
    notifications.refreshPermission();
    notifications.registerForRemoteNotifications();
    notifications.clearAll();

    expect(plugin.refreshPermission).toHaveBeenCalledTimes(1);
    expect(plugin.registerForRemoteNotifications).toHaveBeenCalledTimes(1);
    expect(plugin.clearAll).toHaveBeenCalledTimes(1);
  });
});

describe('SallaPush.Notifications.forwardApnsToken', () => {
  it('passes the hexadecimal text unchanged, for native to decode', () => {
    notifications.forwardApnsToken('A1B2C3');

    expect(plugin.forwardApnsToken).toHaveBeenCalledWith({
      apnsToken: 'A1B2C3',
    });
  });

  it('drops a token that is not a string', () => {
    notifications.forwardApnsToken(null as unknown as string);

    expect(plugin.forwardApnsToken).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Notifications.forwardApnsToken ignored: apnsToken must be a string.'
    );
  });
});

describe('SallaPush.Notifications.removeNotification', () => {
  it('passes an Android notification id', () => {
    notifications.removeNotification(-2147483648);
    notifications.removeNotification(42);

    expect(plugin.removeNotification.mock.calls).toEqual([
      [{ androidNotificationId: -2147483648 }],
      [{ androidNotificationId: 42 }],
    ]);
  });

  it('drops ids that are not 32-bit integers, with one warning', () => {
    for (const id of ['42', 1.5, Number.NaN, 2147483648]) {
      notifications.removeNotification(id as unknown as number);
    }

    expect(plugin.removeNotification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Notifications.removeNotification ignored: androidNotificationId must be a ' +
        '32-bit integer.'
    );
  });
});

describe('SallaPush.Notifications payload helpers', () => {
  it('passes the payload unchanged and resolves native recognition', async () => {
    const payload = {
      custom: { i: 'os-id', a: { push_ref: 'msg_1a2b' } },
      alert: 'Hi',
    };
    plugin.isSallaPushNotification.mockResolvedValueOnce({ value: true });

    await expect(notifications.isSallaPushNotification(payload)).resolves.toBe(
      true
    );
    expect(plugin.isSallaPushNotification.mock.calls[0]?.[0].payload).toBe(
      payload
    );
  });

  it('resolves false for a payload that is not a plain object', async () => {
    await expect(
      notifications.isSallaPushNotification(
        'sp_v' as unknown as Record<string, unknown>
      )
    ).resolves.toBe(false);

    expect(plugin.isSallaPushNotification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Notifications.isSallaPushNotification ignored: payload must be a plain object.'
    );
  });

  it('passes trackOpened data and resolves the answer', async () => {
    const additionalData = { push_ref: 'msg_1a2b', screen: 'offers' };
    plugin.trackOpened.mockResolvedValueOnce({ value: true });

    await expect(notifications.trackOpened(additionalData)).resolves.toBe(true);
    expect(plugin.trackOpened.mock.calls[0]?.[0].additionalData).toBe(
      additionalData
    );
  });

  it('passes trackOpened without data', async () => {
    await expect(notifications.trackOpened(null)).resolves.toBe(false);

    expect(plugin.trackOpened).toHaveBeenCalledWith({ additionalData: null });
  });

  it('resolves false for trackOpened data that is neither an object nor null', async () => {
    await expect(
      notifications.trackOpened(undefined as unknown as null)
    ).resolves.toBe(false);

    expect(plugin.trackOpened).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Notifications.trackOpened ignored: additionalData must be a plain object or null.'
    );
  });
});

describe('SallaPush.Notifications events', () => {
  it("passes taps to 'click' listeners, with native's typed values", async () => {
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();
    subscriptions.push(notifications.addEventListener('click', listener));
    await flush();

    emit('click', {
      notification: {
        notificationId: 'msg_5a11a90001',
        title: 'SallaPush test',
        launchUrl: 'https://example.com/products/42',
        additionalData: { type: 'product', id: '42' },
        rawPayload: { sp_v: '1', sp_id: 'msg_5a11a90001', id: '42' },
        source: 'native',
        stringValues: { type: 'product', id: '42' },
        intValues: { id: 42 },
        boolValues: {},
        numberValues: { id: 42 },
      },
      url: 'https://example.com/products/42',
    });

    expect(plugin.startEvents).toHaveBeenCalledWith({ kind: 'click' });
    const event = listener.mock.calls[0]?.[0];
    expect(event?.result).toEqual({
      actionId: null,
      url: 'https://example.com/products/42',
    });
    expect(event?.notification).toMatchObject({
      notificationId: 'msg_5a11a90001',
      title: 'SallaPush test',
      source: SallaPushPayloadSource.Native,
      additionalData: { type: 'product', id: '42' },
    });
    expect(event?.notification.getString('type')).toBe('product');
    expect(event?.notification.getInt('id')).toBe(42);
  });

  it("passes permission changes to 'permissionChange' listeners", async () => {
    const listener = jest.fn<(permission: boolean) => void>();
    subscriptions.push(
      notifications.addEventListener('permissionChange', listener)
    );
    await flush();

    emit('permissionChange', { permission: true });
    emit('permissionChange', { permission: false });

    expect(plugin.startEvents).toHaveBeenCalledWith({ kind: 'permission' });
    expect(listener.mock.calls).toEqual([[true], [false]]);
  });
});

describe('SallaPush.Notifications without the native plugin', () => {
  it("rejects requests with Capacitor's error and prints one console error per setter", async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.requestPermission.mockRejectedValueOnce(missing);
    plugin.clearAll.mockRejectedValueOnce(missing);

    await expect(notifications.requestPermission()).rejects.toBe(missing);
    notifications.clearAll();
    await flush();

    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Notifications.clearAll failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
  });
});
