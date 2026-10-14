import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  clickEvent,
  loginFailure,
  notification,
  permissionChange,
  subscriptionChange,
  userChange,
  willDisplayEvent,
} from '../internal/mapping';
import { native, type NotificationSpec } from '../internal/native';
import { SallaPushLoginFailure, SallaPushPayloadSource } from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
let warn: jest.SpiedFunction<typeof console.warn>;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

/** A OneSignal-compatible notification as iOS sends it, every field set. */
function compatSpec(): NotificationSpec {
  return {
    notificationId: 'msg_5a11a90002',
    title: 'Order shipped',
    subtitle: 'Today',
    body: 'Your order is on its way',
    imageUrl: 'https://example.com/order.png',
    launchUrl: 'https://example.com/orders/42',
    additionalData: {
      type: 'order',
      id: 42,
      express: true,
      items: [{ sku: 'A-1', quantity: 2 }],
    },
    rawPayload: {
      aps: { alert: { title: 'Order shipped' }, badge: 3 },
      custom: { i: 'os-id', a: { push_ref: 'msg_5a11a90002' } },
    },
    source: 'compat',
    stringValues: { type: 'order', id: '42', express: 'true' },
    intValues: { id: 42, express: 1 },
    boolValues: { express: true },
    numberValues: { id: 42, express: 1 },
    sound: 'default',
    badge: 3,
    threadId: 'orders',
    androidNotificationId: -1234567,
    collapseId: 'order-42',
    channelId: 'orders',
  };
}

/** A native notification as Android sends it, with only what native always sets. */
function minimalSpec(): NotificationSpec {
  return {
    additionalData: {},
    rawPayload: { sp_v: '1' },
    source: 'native',
    stringValues: {},
    intValues: {},
    boolValues: {},
    numberValues: {},
  };
}

describe('notification', () => {
  it('maps every field native sends', () => {
    const spec = compatSpec();

    const mapped = notification(spec);

    expect(mapped).toMatchObject({
      notificationId: 'msg_5a11a90002',
      title: 'Order shipped',
      subtitle: 'Today',
      body: 'Your order is on its way',
      imageUrl: 'https://example.com/order.png',
      launchUrl: 'https://example.com/orders/42',
      source: SallaPushPayloadSource.Compat,
      sound: 'default',
      badge: 3,
      threadId: 'orders',
      androidNotificationId: -1234567,
      collapseId: 'order-42',
      channelId: 'orders',
    });
    expect(mapped.additionalData).toBe(spec.additionalData);
    expect(mapped.additionalData.items).toEqual([{ sku: 'A-1', quantity: 2 }]);
    expect(mapped.rawPayload).toBe(spec.rawPayload);
  });

  it('maps the fields native leaves out, or sends as null, to null', () => {
    const mapped = notification(minimalSpec());
    const nulls = notification({
      ...minimalSpec(),
      notificationId: null,
      title: null,
      badge: null,
      androidNotificationId: null,
    });

    expect(mapped).toMatchObject({
      notificationId: null,
      title: null,
      subtitle: null,
      body: null,
      imageUrl: null,
      launchUrl: null,
      source: SallaPushPayloadSource.Native,
      sound: null,
      badge: null,
      threadId: null,
      androidNotificationId: null,
      collapseId: null,
      channelId: null,
    });
    expect(mapped.additionalData).toEqual({});
    expect(nulls).toMatchObject({
      notificationId: null,
      title: null,
      badge: null,
      androidNotificationId: null,
    });
  });

  it('is immutable', () => {
    const mapped = notification(compatSpec());

    expect(Object.isFrozen(mapped)).toBe(true);
  });
});

describe('notification typed getters', () => {
  it("return native's accessor results", () => {
    const mapped = notification(compatSpec());

    expect(mapped.getString('id')).toBe('42');
    expect(mapped.getString('express')).toBe('true');
    expect(mapped.getInt('id')).toBe(42);
    expect(mapped.getInt('express')).toBe(1);
    expect(mapped.getBool('express')).toBe(true);
    expect(mapped.getNumber('id')).toBe(42);
  });

  it('return null for a key native had no value for', () => {
    const mapped = notification(compatSpec());

    expect(mapped.getString('missing')).toBeNull();
    expect(mapped.getInt('type')).toBeNull();
    expect(mapped.getBool('id')).toBeNull();
    expect(mapped.getNumber('items')).toBeNull();
  });

  it('return null from getNumber on Android, where native has no number accessor', () => {
    const mapped = notification({
      ...minimalSpec(),
      additionalData: { id: '42' },
      stringValues: { id: '42' },
      intValues: { id: 42 },
    });

    expect(mapped.getInt('id')).toBe(42);
    expect(mapped.getNumber('id')).toBeNull();
  });

  it('return null for keys of Object.prototype', () => {
    const mapped = notification(compatSpec());

    for (const key of ['toString', 'constructor', 'hasOwnProperty']) {
      expect(mapped.getString(key)).toBeNull();
      expect(mapped.getInt(key)).toBeNull();
      expect(mapped.getBool(key)).toBeNull();
      expect(mapped.getNumber(key)).toBeNull();
    }
  });

  it('return null for a key that is not a string, with one warning per getter', () => {
    const mapped = notification(compatSpec());
    const key = 42 as unknown as string;

    expect(mapped.getString(key)).toBeNull();
    expect(mapped.getString(key)).toBeNull();
    expect(mapped.getInt(key)).toBeNull();
    expect(mapped.getBool(key)).toBeNull();
    expect(mapped.getNumber(key)).toBeNull();

    expect(warn.mock.calls).toEqual([
      [
        '[SallaPush] SallaPushNotification.getString ignored: key must be a string.',
      ],
      [
        '[SallaPush] SallaPushNotification.getInt ignored: key must be a string.',
      ],
      [
        '[SallaPush] SallaPushNotification.getBool ignored: key must be a string.',
      ],
      [
        '[SallaPush] SallaPushNotification.getNumber ignored: key must be a string.',
      ],
    ]);
  });
});

describe('events', () => {
  it('maps a click with its action and url', () => {
    const event = clickEvent({
      notification: compatSpec(),
      actionId: 'reply',
      url: 'https://example.com/orders/42',
    });

    expect(event.notification.notificationId).toBe('msg_5a11a90002');
    expect(event.result).toEqual({
      actionId: 'reply',
      url: 'https://example.com/orders/42',
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.result)).toBe(true);
  });

  it('maps a click without an action or url to nulls', () => {
    const event = clickEvent({ notification: minimalSpec() });

    expect(event.result).toEqual({ actionId: null, url: null });
  });

  it('maps a permission change', () => {
    expect(permissionChange({ permission: true })).toBe(true);
    expect(permissionChange({ permission: false })).toBe(false);
  });

  it('maps a user change, a guest with a null external id', () => {
    const change = userChange({
      previous: { isLoggedIn: false },
      current: { externalId: 'customer-7', isLoggedIn: true },
    });

    expect(change).toEqual({
      previous: { externalId: null, isLoggedIn: false },
      current: { externalId: 'customer-7', isLoggedIn: true },
    });
    expect(Object.isFrozen(change.previous)).toBe(true);
  });

  it('maps both login failures', () => {
    expect(loginFailure({ failure: 'tokenRejected' })).toBe(
      SallaPushLoginFailure.TokenRejected
    );
    expect(loginFailure({ failure: 'invalidRequest' })).toBe(
      SallaPushLoginFailure.InvalidRequest
    );
  });

  it('maps a subscription change without its listener id', () => {
    const change = subscriptionChange({
      listenerId: 3,
      previous: { optedIn: false },
      current: {
        id: '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40',
        token: 'a1b2c3',
        optedIn: true,
      },
    });

    expect(change).toEqual({
      previous: { id: null, token: null, optedIn: false },
      current: {
        id: '3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40',
        token: 'a1b2c3',
        optedIn: true,
      },
    });
    expect(Object.isFrozen(change.current)).toBe(true);
  });
});

describe('display', () => {
  it("shows a prevented will-display event's notification through its handle", () => {
    const event = willDisplayEvent({
      handle: '0c9d1c5e-1b7f-4f4e-9a6b-2f0f4c1d3e5a',
      notification: compatSpec(),
    });

    event.preventDefault();
    event.notification.display();
    event.notification.display();

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '0c9d1c5e-1b7f-4f4e-9a6b-2f0f4c1d3e5a' }],
      [{ handle: '0c9d1c5e-1b7f-4f4e-9a6b-2f0f4c1d3e5a' }],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("refuses a will-display event's notification that wasn't prevented, as native does, and warns once in every build", () => {
    const event = willDisplayEvent({
      handle: '0c9d1c5e-1b7f-4f4e-9a6b-2f0f4c1d3e5a',
      notification: compatSpec(),
    });

    event.notification.display();
    event.notification.display();

    expect(plugin.displayNotification).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      [
        '[SallaPush] SallaPushNotification.display() did nothing: it was not prevented. Call event.preventDefault() first.',
      ],
    ]);
  });

  it('does nothing for a tapped notification, and warns once in every build', () => {
    const tapped = clickEvent({ notification: compatSpec() }).notification;

    tapped.display();
    tapped.display();
    notification(minimalSpec()).display();

    expect(plugin.displayNotification).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      [
        '[SallaPush] SallaPushNotification.display() does nothing here: it shows only the notification of a ' +
          "'foregroundWillDisplay' event.",
      ],
    ]);
  });
});

describe('will-display events', () => {
  it('carry the notification and record preventDefault()', () => {
    const event = willDisplayEvent({
      handle: '0c9d1c5e-1b7f-4f4e-9a6b-2f0f4c1d3e5a',
      notification: compatSpec(),
    });

    expect(event.notification.notificationId).toBe('msg_5a11a90002');
    expect(event.isPrevented).toBe(false);
    event.preventDefault();
    expect(event.isPrevented).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
  });
});
