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
import { native, type LogEntrySpec } from '../internal/native';
import type * as Index from '../index';
import { SallaPush, SallaPushLogLevel, type SallaPushLogEntry } from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

/** Lets the rejections of sent calls reach their handlers. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe('SallaPush.Debug', () => {
  it.each(Object.values(SallaPushLogLevel))(
    'resolves the log level %s native reports',
    async (level) => {
      plugin.getLogLevel.mockResolvedValueOnce({ value: level });

      await expect(SallaPush.Debug.getLogLevel()).resolves.toBe(level);
    }
  );

  it.each(Object.values(SallaPushLogLevel))(
    'sets the log level %s',
    (level) => {
      SallaPush.Debug.setLogLevel(level);

      expect(plugin.setLogLevel).toHaveBeenCalledWith({ level });
    }
  );

  it('drops an unknown log level, with one warning', () => {
    for (const level of ['Debug', 'trace', 3, null]) {
      SallaPush.Debug.setLogLevel(level as unknown as SallaPushLogLevel);
    }

    expect(plugin.setLogLevel).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[SallaPush] SallaPush.Debug.setLogLevel ignored: level must be one of 'off', 'error', 'warn', " +
        "'info', 'debug', 'verbose'."
    );
  });

  it("rejects getLogLevel with Capacitor's error and reports setLogLevel once when the native plugin is missing", async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.getLogLevel.mockRejectedValueOnce(missing);
    plugin.setLogLevel
      .mockRejectedValueOnce(missing)
      .mockRejectedValueOnce(missing);

    await expect(SallaPush.Debug.getLogLevel()).rejects.toBe(missing);
    SallaPush.Debug.setLogLevel(SallaPushLogLevel.Debug);
    SallaPush.Debug.setLogLevel(SallaPushLogLevel.Info);
    await flush();

    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Debug.setLogLevel failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
  });
});

describe('SallaPush.Debug.setLogHandler', () => {
  type Handler = jest.Mock<(entry: SallaPushLogEntry) => void>;

  const entry: LogEntrySpec = {
    level: 'warn',
    category: 'registration',
    code: 'register.retry',
    message: 'Registration failed (HTTP 503); retrying in 30 s.',
    metadata: { http_status: '503', attempt: '2' },
    timestamp: 1_800_000_000_123,
  };

  let api: typeof Index.SallaPush;
  let mock: typeof NativeMock.native;
  let emit: typeof NativeMock.emit;

  // The hub keeps its Capacitor listener for the page's lifetime, so every test loads the API afresh, as a new page does.
  beforeEach(() => {
    jest.resetModules();
    ({ SallaPush: api } = jest.requireActual<typeof Index>('../index'));
    ({ native: mock, emit } =
      jest.requireMock<typeof NativeMock>('../internal/native'));
  });

  /** The native plugin's calls in this test, by method name, in the order they were made. */
  function nativeCalls(): string[] {
    return Object.entries(mock)
      .flatMap(([name, method]) =>
        method.mock.invocationCallOrder.map((order) => ({ name, order }))
      )
      .sort((first, second) => first.order - second.order)
      .map(({ name }) => name);
  }

  /** The handle of the first Capacitor listener added in this test. */
  async function handle() {
    const added = mock.addListener.mock.results[0];
    if (added?.type !== 'return') {
      throw new Error('no Capacitor listener');
    }
    return added.value;
  }

  it('sets the native level, then adds the Capacitor listener, then starts the native registration', async () => {
    api.Debug.setLogHandler(SallaPushLogLevel.Info, () => {});
    await flush();

    expect(mock.setLogHandlerLevel.mock.calls).toEqual([[{ level: 'info' }]]);
    expect(mock.addListener.mock.calls.map(([name]) => name)).toEqual(['log']);
    expect(mock.startEvents.mock.calls).toEqual([[{ kind: 'log' }]]);
    expect(nativeCalls()).toEqual([
      'setLogHandlerLevel',
      'addListener',
      'startEvents',
    ]);
  });

  it('passes each entry to the handler', async () => {
    const handler: Handler = jest.fn();
    api.Debug.setLogHandler(SallaPushLogLevel.Debug, handler);
    await flush();

    emit('log', entry);

    expect(handler).toHaveBeenCalledWith({
      level: SallaPushLogLevel.Warn,
      category: 'registration',
      code: 'register.retry',
      message: 'Registration failed (HTTP 503); retrying in 30 s.',
      metadata: { http_status: '503', attempt: '2' },
      timestamp: 1_800_000_000_123,
    });
    expect(Object.isFrozen(handler.mock.calls[0]?.[0])).toBe(true);
  });

  it('replaces the handler, and sends only the new level to native', async () => {
    const first: Handler = jest.fn();
    const second: Handler = jest.fn();

    api.Debug.setLogHandler(SallaPushLogLevel.Warn, first);
    api.Debug.setLogHandler(SallaPushLogLevel.Verbose, second);
    await flush();
    emit('log', entry);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(mock.setLogHandlerLevel.mock.calls).toEqual([
      [{ level: 'warn' }],
      [{ level: 'verbose' }],
    ]);
    expect(mock.addListener).toHaveBeenCalledTimes(1);
    expect(mock.startEvents).toHaveBeenCalledTimes(1);
  });

  it('removes the handler with null: stops the native registration and keeps the Capacitor listener', async () => {
    const handler: Handler = jest.fn();
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, handler);
    await flush();

    api.Debug.setLogHandler(SallaPushLogLevel.Warn, null);
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, null);
    await flush();
    emit('log', entry);

    expect(handler).not.toHaveBeenCalled();
    expect(mock.stopEvents.mock.calls).toEqual([[{ kind: 'log' }]]);
    expect((await handle()).remove).not.toHaveBeenCalled();
  });

  it('starts again after a removal, with the same Capacitor listener', async () => {
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, () => {});
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, null);
    api.Debug.setLogHandler(SallaPushLogLevel.Error, () => {});
    await flush();

    expect(nativeCalls()).toEqual([
      'setLogHandlerLevel',
      'addListener',
      'startEvents',
      'stopEvents',
      'setLogHandlerLevel',
      'startEvents',
    ]);
    expect(mock.setLogHandlerLevel.mock.calls).toEqual([
      [{ level: 'warn' }],
      [{ level: 'error' }],
    ]);
  });

  it('sends nothing for a removal without a handler', async () => {
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, null);
    await flush();

    expect(nativeCalls()).toEqual([]);
  });

  it('reports a handler that throws', async () => {
    const failure = new Error('handler failed');
    api.Debug.setLogHandler(SallaPushLogLevel.Warn, () => {
      throw failure;
    });
    await flush();

    emit('log', entry);

    expect(error).toHaveBeenCalledWith(
      '[SallaPush] A SallaPush.Debug log handler threw:',
      failure
    );
  });

  it('drops a call with an unknown level or a handler that is neither a function nor null', async () => {
    api.Debug.setLogHandler('trace' as SallaPushLogLevel, () => {});
    api.Debug.setLogHandler(
      SallaPushLogLevel.Warn,
      undefined as unknown as null
    );
    await flush();

    expect(nativeCalls()).toEqual([]);
    expect(warn.mock.calls).toEqual([
      [
        "[SallaPush] SallaPush.Debug.setLogHandler ignored: level must be one of 'off', 'error', 'warn', " +
          "'info', 'debug', 'verbose'.",
      ],
      [
        '[SallaPush] SallaPush.Debug.setLogHandler ignored: handler must be a function or null.',
      ],
    ]);
  });

  it('reports a handler it could not set once, when the native plugin is missing', async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    mock.setLogHandlerLevel.mockRejectedValueOnce(missing);
    mock.addListener.mockRejectedValueOnce(missing);
    mock.startEvents.mockRejectedValueOnce(missing);

    api.Debug.setLogHandler(SallaPushLogLevel.Warn, () => {});
    await flush();

    expect(nativeCalls()).toEqual([
      'setLogHandlerLevel',
      'addListener',
      'startEvents',
    ]);
    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Debug log handler failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
  });
});
