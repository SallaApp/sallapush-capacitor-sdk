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
let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe('SallaPush getters', () => {
  it('resolve the values native reads at call time', async () => {
    plugin.getSdkVersion.mockResolvedValueOnce({ value: '1.0.3' });

    await expect(SallaPush.getSdkVersion()).resolves.toBe('1.0.3');
    expect(plugin.getSdkVersion).toHaveBeenCalledTimes(1);
    expect(plugin.getSdkVersion).toHaveBeenCalledWith();
  });

  it('ask native at every call, so nothing is cached', async () => {
    plugin.getSdkVersion
      .mockResolvedValueOnce({ value: '1.0.3' })
      .mockResolvedValueOnce({ value: '1.0.4' });

    await expect(SallaPush.getSdkVersion()).resolves.toBe('1.0.3');
    await expect(SallaPush.getSdkVersion()).resolves.toBe('1.0.4');
    expect(plugin.getSdkVersion).toHaveBeenCalledTimes(2);
  });

  it("reject with Capacitor's error when the native plugin is missing, and print nothing", async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.getSdkVersion.mockRejectedValueOnce(missing);

    await expect(SallaPush.getSdkVersion()).rejects.toBe(missing);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
