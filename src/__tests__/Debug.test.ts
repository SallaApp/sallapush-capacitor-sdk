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
import { SallaPush, SallaPushLogLevel } from '../index';

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
