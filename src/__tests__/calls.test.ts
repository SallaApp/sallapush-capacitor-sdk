import { CapacitorException, ExceptionCode } from '@capacitor/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { nullable, reportFailure, send, value } from '../internal/calls';
import { warnOnce } from '../internal/consoleOnce';
import { native } from '../internal/native';

// The real plugin proxy: under Jest, Capacitor runs as on the web, where SallaPush has no implementation.
const NOT_IMPLEMENTED = '"SallaPush" plugin is not implemented on web';

/** Lets the rejections of sent calls reach their handlers. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

// Each case uses its own method names: the console helpers report a key once per JavaScript runtime.
describe('send', () => {
  it('reports one console error per method when the native plugin is missing', async () => {
    send('SallaPush.webFirst', () => native.getSdkVersion());
    send('SallaPush.webFirst', () => native.getSdkVersion());
    send('SallaPush.webSecond', () => native.getSdkVersion());
    await flush();

    expect(error.mock.calls).toEqual([
      [`[SallaPush] SallaPush.webFirst failed: ${NOT_IMPLEMENTED}`],
      [`[SallaPush] SallaPush.webSecond failed: ${NOT_IMPLEMENTED}`],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('makes the call at once and reports nothing when it resolves', async () => {
    const call = jest.fn(() => Promise.resolve());

    send('SallaPush.resolves', call);

    expect(call).toHaveBeenCalledTimes(1);
    await flush();
    expect(error).not.toHaveBeenCalled();
  });

  it('reports a synchronous throw the same way, once per method, without throwing', () => {
    const call = (): Promise<void> => {
      throw new TypeError('native.logout is not a function');
    };

    expect(() => send('SallaPush.throws', call)).not.toThrow();
    expect(() => send('SallaPush.throws', call)).not.toThrow();

    expect(error.mock.calls).toEqual([
      ['[SallaPush] SallaPush.throws failed: native.logout is not a function'],
    ]);
  });

  it('reports a rejection that is not an Error by its text', async () => {
    send('SallaPush.rejectsText', () => Promise.reject('closed'));
    await flush();

    expect(error.mock.calls).toEqual([
      ['[SallaPush] SallaPush.rejectsText failed: closed'],
    ]);
  });
});

describe('value', () => {
  it.each<[unknown]>([['1.0.3'], [''], [false], [0], [null]])(
    'unwraps %j',
    async (result) => {
      await expect(value(Promise.resolve({ value: result }))).resolves.toBe(
        result
      );
    }
  );

  it("propagates a rejection, such as Capacitor's UNIMPLEMENTED error, and prints nothing", async () => {
    const request = value(native.getSdkVersion());

    await expect(request).rejects.toBeInstanceOf(CapacitorException);
    await expect(request).rejects.toMatchObject({
      code: ExceptionCode.Unimplemented,
      message: NOT_IMPLEMENTED,
    });
    expect(error).not.toHaveBeenCalled();
  });
});

describe('nullable', () => {
  it.each<[unknown]>([['st_42_cap'], [''], [false], [0]])(
    'unwraps %j',
    async (result) => {
      await expect(nullable(Promise.resolve({ value: result }))).resolves.toBe(
        result
      );
    }
  );

  it.each<[string, { value?: string | null }]>([
    ['a missing value', {}],
    ['an undefined value', { value: undefined }],
    ['a null value', { value: null }],
  ])('maps %s to null', async (_, result) => {
    await expect(nullable(Promise.resolve(result))).resolves.toBeNull();
  });

  it('propagates a rejection', async () => {
    const missing = new CapacitorException(
      NOT_IMPLEMENTED,
      ExceptionCode.Unimplemented
    );

    await expect(nullable(Promise.reject(missing))).rejects.toBe(missing);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the console helpers', () => {
  it('report a failure with the method and the error message, once per method', () => {
    reportFailure(
      'SallaPush.reported',
      new CapacitorException(NOT_IMPLEMENTED, ExceptionCode.Unimplemented)
    );
    reportFailure('SallaPush.reported', new Error('another failure'));

    expect(error.mock.calls).toEqual([
      [`[SallaPush] SallaPush.reported failed: ${NOT_IMPLEMENTED}`],
    ]);
  });

  it('warn once per key, with the [SallaPush] prefix', () => {
    warnOnce('calls.test(first)', 'first warning');
    warnOnce('calls.test(first)', 'first warning again');
    warnOnce('calls.test(second)', 'second warning');

    expect(warn.mock.calls).toEqual([
      ['[SallaPush] first warning'],
      ['[SallaPush] second warning'],
    ]);
    expect(error).not.toHaveBeenCalled();
  });
});
