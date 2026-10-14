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
import type { ClickEventSpec, NotificationSpec } from '../internal/native';
import type * as Index from '../index';
import {
  SallaPushLogLevel,
  type SallaPushClickEvent,
  type SallaPushEventSubscription,
} from '../index';

jest.mock('../internal/native');

let SallaPush: typeof Index.SallaPush;
let native: typeof NativeMock.native;
let emit: typeof NativeMock.emit;
let flush: typeof NativeMock.flush;
let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

// A hub keeps its Capacitor listener for the page's lifetime, so every test loads the API afresh, as a new page does.
beforeEach(() => {
  jest.resetModules();
  ({ SallaPush } = jest.requireActual<typeof Index>('../index'));
  ({ native, emit, flush } =
    jest.requireMock<typeof NativeMock>('../internal/native'));
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

function onClick(
  listener: (event: SallaPushClickEvent) => void
): SallaPushEventSubscription {
  return SallaPush.Notifications.addEventListener('click', listener);
}

function click(notificationId: string): ClickEventSpec {
  const notification: NotificationSpec = {
    notificationId,
    additionalData: {},
    rawPayload: {},
    source: 'native',
    stringValues: {},
    intValues: {},
    boolValues: {},
    numberValues: {},
  };
  return { notification };
}

/** The native plugin's calls in this test, by method name, in the order they were made. */
function nativeCalls(): string[] {
  return Object.entries(native)
    .flatMap(([name, method]) =>
      method.mock.invocationCallOrder.map((order) => ({ name, order }))
    )
    .sort((first, second) => first.order - second.order)
    .map(({ name }) => name);
}

/** The handle of the n-th Capacitor listener added in this test. */
async function handle(index: number) {
  const added = native.addListener.mock.results[index];
  if (added?.type !== 'return') {
    throw new Error(`no Capacitor listener ${index}`);
  }
  return added.value;
}

/** Each event kind: how JavaScript adds a listener, its Capacitor event and the native registration behind it. */
const kinds = [
  {
    event: "SallaPush.Notifications 'click'",
    eventName: 'click',
    kind: 'click',
    add: (listener: () => void) =>
      SallaPush.Notifications.addEventListener('click', listener),
  },
  {
    event: "SallaPush.Notifications 'permissionChange'",
    eventName: 'permissionChange',
    kind: 'permission',
    add: (listener: () => void) =>
      SallaPush.Notifications.addEventListener('permissionChange', listener),
  },
  {
    event: "SallaPush.User 'change'",
    eventName: 'userChange',
    kind: 'user',
    add: (listener: () => void) =>
      SallaPush.User.addEventListener('change', listener),
  },
  {
    event: "SallaPush.User 'loginFailure'",
    eventName: 'loginFailure',
    kind: 'loginFailure',
    add: (listener: () => void) =>
      SallaPush.User.addEventListener('loginFailure', listener),
  },
];

describe.each(kinds)('$event listeners', ({ eventName, kind, add }) => {
  it('add the Capacitor listener once, before they start the native registration', async () => {
    add(() => {});
    add(() => {});
    await flush();

    expect(native.addListener.mock.calls.map(([name]) => name)).toEqual([
      eventName,
    ]);
    expect(native.startEvents.mock.calls).toEqual([[{ kind }]]);
    expect(nativeCalls()).toEqual(['addListener', 'startEvents']);
  });

  it('share one native registration, stopped after the last removal, and keep the Capacitor listener', async () => {
    const first = add(() => {});
    const second = add(() => {});
    await flush();

    first.remove();
    await flush();
    expect(native.stopEvents).not.toHaveBeenCalled();

    second.remove();
    await flush();
    expect(native.startEvents.mock.calls).toEqual([[{ kind }]]);
    expect(native.stopEvents.mock.calls).toEqual([[{ kind }]]);
    expect((await handle(0)).remove).not.toHaveBeenCalled();
  });

  it('start again after the last removal, with the same Capacitor listener', async () => {
    add(() => {}).remove();
    add(() => {});
    await flush();

    expect(nativeCalls()).toEqual([
      'addListener',
      'startEvents',
      'stopEvents',
      'startEvents',
    ]);
    expect(native.startEvents.mock.calls).toEqual([[{ kind }], [{ kind }]]);
  });
});

describe('event listeners', () => {
  it('register the same function once', async () => {
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();

    const first = onClick(listener);
    onClick(listener);
    await flush();
    emit('click', click('msg_1'));

    expect(native.addListener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    first.remove();
    await flush();
    expect(native.stopEvents).toHaveBeenCalledTimes(1);
  });

  it('are removed by remove() and by removeEventListener', async () => {
    const first = jest.fn<(event: SallaPushClickEvent) => void>();
    const second = jest.fn<(event: SallaPushClickEvent) => void>();
    onClick(first).remove();
    onClick(second);
    await flush();

    emit('click', click('msg_1'));
    SallaPush.Notifications.removeEventListener('click', second);
    emit('click', click('msg_2'));
    await flush();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(native.stopEvents.mock.calls).toEqual([
      [{ kind: 'click' }],
      [{ kind: 'click' }],
    ]);
  });

  it('get events in native order, in the order they were added', async () => {
    const received: string[] = [];
    onClick((event) =>
      received.push(`first ${event.notification.notificationId}`)
    );
    onClick((event) =>
      received.push(`second ${event.notification.notificationId}`)
    );
    await flush();

    emit('click', click('msg_1'));
    emit('click', click('msg_2'));

    expect(received).toEqual([
      'first msg_1',
      'second msg_1',
      'first msg_2',
      'second msg_2',
    ]);
  });

  it('removed during a dispatch still get that event', async () => {
    const second = jest.fn<(event: SallaPushClickEvent) => void>();
    onClick(() => SallaPush.Notifications.removeEventListener('click', second));
    onClick(second);
    await flush();

    emit('click', click('msg_1'));
    emit('click', click('msg_2'));

    expect(second).toHaveBeenCalledTimes(1);
  });

  it('that throw are reported, and the others still run', async () => {
    const failure = new Error('listener failed');
    const second = jest.fn<(event: SallaPushClickEvent) => void>();
    onClick(() => {
      throw failure;
    });
    onClick(second);
    await flush();

    emit('click', click('msg_1'));

    expect(second).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "[SallaPush] A SallaPush.Notifications 'click' listener threw:",
      failure
    );
  });

  it('get nothing once removed, even an event native emitted before the removal', async () => {
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();
    const subscription = onClick(listener);
    await flush();

    subscription.remove();
    emit('click', click('msg_1'));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('native steps', () => {
  it('run one after another: a slow native call holds back the calls made after it', async () => {
    let started: () => void = () => {};
    native.startEvents.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          started = resolve;
        })
    );
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();

    onClick(listener).remove();
    onClick(listener);
    await flush();
    expect(nativeCalls()).toEqual(['addListener', 'startEvents']);

    started();
    await flush();
    expect(nativeCalls()).toEqual([
      'addListener',
      'startEvents',
      'stopEvents',
      'startEvents',
    ]);
  });

  it('report a Capacitor listener that could not be added once, and add it with the next first listener', async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    native.addListener
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(missing);
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();

    onClick(() => {}).remove();
    await flush();
    onClick(() => {}).remove();
    await flush();
    onClick(listener);
    await flush();
    emit('click', click('msg_1'));

    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Notifications \'click\' listener failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
    expect(nativeCalls()).toEqual([
      'addListener',
      'stopEvents',
      'addListener',
      'stopEvents',
      'addListener',
      'startEvents',
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('add the push-subscription Capacitor listener once, before the first native observer', async () => {
    SallaPush.User.pushSubscription.addEventListener('change', () => {});
    SallaPush.User.pushSubscription.addEventListener('change', () => {});
    await flush();

    expect(native.addListener.mock.calls.map(([name]) => name)).toEqual([
      'pushSubscriptionChange',
    ]);
    expect(nativeCalls()).toEqual([
      'addListener',
      'addPushSubscriptionListener',
      'addPushSubscriptionListener',
    ]);
    expect(native.startEvents).not.toHaveBeenCalled();
  });

  it('send the log level before the first log registration, and only the level on later changes', async () => {
    SallaPush.Debug.setLogHandler(SallaPushLogLevel.Info, () => {});
    SallaPush.Debug.setLogHandler(SallaPushLogLevel.Debug, () => {});
    await flush();

    expect(nativeCalls()).toEqual([
      'setLogHandlerLevel',
      'addListener',
      'startEvents',
      'setLogHandlerLevel',
    ]);
    expect(native.setLogHandlerLevel.mock.calls).toEqual([
      [{ level: 'info' }],
      [{ level: 'debug' }],
    ]);
    expect(native.addListener.mock.calls.map(([name]) => name)).toEqual([
      'log',
    ]);
  });
});

describe('addEventListener and removeEventListener validation', () => {
  it('drops an unknown event, with one warning and an inert subscription', async () => {
    const subscription = SallaPush.Notifications.addEventListener(
      'opened' as 'click',
      () => {}
    );
    SallaPush.Notifications.addEventListener('Click' as 'click', () => {});
    subscription.remove();
    await flush();

    expect(nativeCalls()).toEqual([]);
    expect(warn.mock.calls).toEqual([
      [
        "[SallaPush] SallaPush.Notifications.addEventListener ignored: event must be one of 'click', " +
          "'foregroundWillDisplay', 'permissionChange'.",
      ],
    ]);
  });

  it('drops a listener that is not a function', async () => {
    SallaPush.User.addEventListener(
      'change',
      'onChange' as unknown as () => void
    );
    await flush();

    expect(nativeCalls()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.addEventListener ignored: listener must be a function.'
    );
  });

  it('drops a removal with an unknown event or a listener that is not a function', async () => {
    const listener = jest.fn<(event: SallaPushClickEvent) => void>();
    onClick(listener);
    await flush();

    SallaPush.Notifications.removeEventListener('opened' as 'click', listener);
    SallaPush.User.removeEventListener(
      'loginFailure',
      null as unknown as () => void
    );
    await flush();
    emit('click', click('msg_1'));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(native.stopEvents).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      [
        "[SallaPush] SallaPush.Notifications.removeEventListener ignored: event must be one of 'click', " +
          "'foregroundWillDisplay', 'permissionChange'.",
      ],
      [
        '[SallaPush] SallaPush.User.removeEventListener ignored: listener must be a function.',
      ],
    ]);
  });

  it('ignores the removal of a listener that was never added', async () => {
    SallaPush.User.removeEventListener('change', () => {});
    SallaPush.User.pushSubscription.removeEventListener('change', () => {});
    await flush();

    expect(nativeCalls()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});
