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

describe('SallaPush.Migration', () => {
  it.each([true, false])('passes setDisplayCompatPayloads(%s)', (display) => {
    SallaPush.Migration.setDisplayCompatPayloads(display);

    expect(plugin.setDisplayCompatPayloads).toHaveBeenCalledWith({
      display,
    });
  });

  it('drops a setting that is not a boolean', () => {
    SallaPush.Migration.setDisplayCompatPayloads('false' as unknown as boolean);

    expect(plugin.setDisplayCompatPayloads).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.Migration.setDisplayCompatPayloads ignored: display must be a boolean.'
    );
  });

  it('reports a missing native plugin with one console error', async () => {
    plugin.setDisplayCompatPayloads.mockRejectedValueOnce(
      new CapacitorException(
        '"SallaPush" plugin is not implemented on web',
        ExceptionCode.Unimplemented
      )
    );

    SallaPush.Migration.setDisplayCompatPayloads(true);
    await flush();

    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.Migration.setDisplayCompatPayloads failed: "SallaPush" plugin is not ' +
          'implemented on web',
      ],
    ]);
  });
});
