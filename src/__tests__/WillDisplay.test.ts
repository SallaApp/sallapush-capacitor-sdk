import { CapacitorException, ExceptionCode } from '@capacitor/core';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type * as NativeMock from '../internal/__mocks__/native';
import { native, type NotificationSpec } from '../internal/native';
import {
  SallaPush,
  type SallaPushEventSubscription,
  type SallaPushWillDisplayEvent,
} from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
const {
  native: mock,
  emit: emitEvent,
  flush,
} = jest.requireMock<typeof NativeMock>('../internal/native');
const subscriptions: SallaPushEventSubscription[] = [];
let error: jest.SpiedFunction<typeof console.error>;
let handle: { remove: unknown } | undefined;
let connectedAt: number;
let startedAt: number;

type Listener = jest.Mock<(event: SallaPushWillDisplayEvent) => void>;

// The hub adds its Capacitor listener with its first listener ever, and keeps it for the page.
beforeAll(async () => {
  SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    () => {}
  ).remove();
  await flush();
  const added = mock.addListener.mock.results[0];
  handle = added?.type === 'return' ? await added.value : undefined;
  connectedAt = plugin.addListener.mock.invocationCallOrder[0] ?? 0;
  startedAt = plugin.startEvents.mock.invocationCallOrder[0] ?? 0;
});

beforeEach(() => {
  jest.clearAllMocks();
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  for (const subscription of subscriptions.splice(0)) {
    subscription.remove();
  }
  await flush();
  error.mockRestore();
});

function listen(listener: Listener = jest.fn()): Listener {
  subscriptions.push(
    SallaPush.Notifications.addEventListener('foregroundWillDisplay', listener)
  );
  return listener;
}

const notification: NotificationSpec = {
  notificationId: 'msg_5a11a90001',
  title: 'SallaPush test',
  body: 'A native SallaPush notification',
  additionalData: { type: 'product', id: '42' },
  rawPayload: { sp_v: '1', sp_id: 'msg_5a11a90001', type: 'product' },
  source: 'native',
  stringValues: { type: 'product', id: '42' },
  intValues: { id: 42 },
  boolValues: {},
  numberValues: { id: 42 },
};

/** Emits what native's will-display listener sends for a notification it holds under `handle`. */
function emit(held: string): void {
  emitEvent('willDisplay', { handle: held, notification });
}

describe("SallaPush.Notifications 'foregroundWillDisplay' listeners", () => {
  it('add the Capacitor listener before the native registration starts', () => {
    expect(handle).toBeDefined();
    expect(connectedAt).toBeGreaterThan(0);
    expect(connectedAt).toBeLessThan(startedAt);
  });

  it('start and stop the native registration, and keep the Capacitor listener', async () => {
    listen();
    listen();
    subscriptions.splice(0).forEach((subscription) => subscription.remove());
    listen();
    await flush();

    expect(plugin.startEvents.mock.calls).toEqual([
      [{ kind: 'willDisplay' }],
      [{ kind: 'willDisplay' }],
    ]);
    expect(plugin.stopEvents.mock.calls).toEqual([[{ kind: 'willDisplay' }]]);
    expect(plugin.addListener).not.toHaveBeenCalled();
    expect(handle?.remove).not.toHaveBeenCalled();
  });

  it('get the notification native holds', () => {
    const listener = listen();

    emit('7d9c2a54');

    const event = listener.mock.calls[0]?.[0];
    expect(event?.notification).toMatchObject({
      notificationId: 'msg_5a11a90001',
      title: 'SallaPush test',
      additionalData: { type: 'product', id: '42' },
    });
    expect(event?.notification.getInt('id')).toBe(42);
  });

  it('show a notification no listener prevented, once the listeners returned', () => {
    const listener = listen();

    emit('7d9c2a54');

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
    ]);
    expect(listener.mock.invocationCallOrder[0]).toBeLessThan(
      plugin.displayNotification.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('keep a notification hidden when one of them prevented it', () => {
    const seen: boolean[] = [];
    const record = (event: SallaPushWillDisplayEvent) => {
      seen.push(event.isPrevented);
    };
    listen(jest.fn(record));
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) => event.preventDefault())
    );
    listen(jest.fn(record));

    emit('7d9c2a54');

    expect(seen).toEqual([false, true]);
    expect(plugin.displayNotification).not.toHaveBeenCalled();
  });

  it('still decide when a listener throws', () => {
    const failure = new Error('listener failed');
    listen(
      jest.fn(() => {
        throw failure;
      })
    );
    const second = listen();

    emit('7d9c2a54');

    expect(second).toHaveBeenCalledTimes(1);
    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
    ]);
    expect(error).toHaveBeenCalledWith(
      "[SallaPush] A SallaPush.Notifications 'foregroundWillDisplay' listener threw:",
      failure
    );
  });

  it('keep a notification hidden when the listener that prevented it threw', () => {
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) => {
        event.preventDefault();
        throw new Error('listener failed');
      })
    );

    emit('7d9c2a54');

    expect(plugin.displayNotification).not.toHaveBeenCalled();
  });

  it('show a notification a listener prevented and displayed at once, once', () => {
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) => {
        event.preventDefault();
        event.notification.display();
      })
    );

    emit('7d9c2a54');

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
    ]);
  });

  it('keep a notification hidden when a later one prevents it after an earlier one called display() without preventing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) =>
        event.notification.display()
      )
    );
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) => event.preventDefault())
    );

    emit('7d9c2a54');

    expect(plugin.displayNotification).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('show a prevented notification when the app calls display() later', () => {
    const held: SallaPushWillDisplayEvent[] = [];
    listen(
      jest.fn((event: SallaPushWillDisplayEvent) => {
        event.preventDefault();
        held.push(event);
      })
    );

    emit('7d9c2a54');
    expect(plugin.displayNotification).not.toHaveBeenCalled();
    held[0]?.notification.display();

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
    ]);
  });

  it('ignore a preventDefault() made after they returned', () => {
    const held: SallaPushWillDisplayEvent[] = [];
    listen(jest.fn((event: SallaPushWillDisplayEvent) => held.push(event)));

    emit('7d9c2a54');
    held[0]?.preventDefault();

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
    ]);
  });

  it('send the decision without awaiting it: a failing displayNotification is reported once', async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.displayNotification
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(missing);
    listen();

    emit('7d9c2a54');
    emit('5b0e9f13');
    await flush();

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '7d9c2a54' }],
      [{ handle: '5b0e9f13' }],
    ]);
    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Notifications \'foregroundWillDisplay\' listener failed: "SallaPush" plugin is not ' +
          'implemented on web',
      ],
    ]);
  });
});

describe('a will-display event without a listener', () => {
  it('is shown: native held it, and the last listener was removed while it was on its way', () => {
    SallaPush.Notifications.addEventListener(
      'foregroundWillDisplay',
      () => {}
    ).remove();

    emit('5b0e9f13');

    expect(plugin.displayNotification.mock.calls).toEqual([
      [{ handle: '5b0e9f13' }],
    ]);
  });
});
