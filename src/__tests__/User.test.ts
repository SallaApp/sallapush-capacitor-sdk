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
  SallaPushLoginFailure,
  type SallaPushEventSubscription,
  type SallaPushUserChangedState,
} from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
const { emit, flush } =
  jest.requireMock<typeof NativeMock>('../internal/native');
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

describe('SallaPush.User getters', () => {
  it('resolve the customer native reads at call time', async () => {
    plugin.getExternalId.mockResolvedValueOnce({ value: 'customer-7' });
    plugin.isLoggedIn.mockResolvedValueOnce({ value: true });

    await expect(SallaPush.User.getExternalId()).resolves.toBe('customer-7');
    await expect(SallaPush.User.isLoggedIn()).resolves.toBe(true);
  });

  it('resolve a guest as native reads it', async () => {
    await expect(SallaPush.User.getExternalId()).resolves.toBeNull();
    await expect(SallaPush.User.isLoggedIn()).resolves.toBe(false);
  });

  it('resolve the tags native holds', async () => {
    plugin.getTags.mockResolvedValueOnce({
      value: { level: 'gold', city: 'riyadh' },
    });

    await expect(SallaPush.User.getTags()).resolves.toEqual({
      level: 'gold',
      city: 'riyadh',
    });
  });

  it("reject with Capacitor's error when the native plugin is missing", async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.getTags.mockRejectedValueOnce(missing);

    await expect(SallaPush.User.getTags()).rejects.toBe(missing);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('SallaPush.User tags', () => {
  it('passes addTag and removeTag unchanged, for native to normalise', () => {
    SallaPush.User.addTag(' Level ', '');
    SallaPush.User.removeTag(' City ');

    expect(plugin.addTag).toHaveBeenCalledWith({ key: ' Level ', value: '' });
    expect(plugin.removeTag).toHaveBeenCalledWith({ key: ' City ' });
  });

  it('passes the tags object unchanged, non-string values included', () => {
    const tags = { level: 'gold', visits: 3, vip: true };

    SallaPush.User.addTags(tags as unknown as Record<string, string>);

    expect(plugin.addTags).toHaveBeenCalledTimes(1);
    expect(plugin.addTags.mock.calls[0]?.[0].tags).toBe(tags);
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes the keys array unchanged, non-string keys included', () => {
    const keys = ['level', 3];

    SallaPush.User.removeTags(keys as unknown as string[]);

    expect(plugin.removeTags.mock.calls[0]?.[0].keys).toBe(keys);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops an addTag with a boolean value', () => {
    SallaPush.User.addTag('vip', true as unknown as string);

    expect(plugin.addTag).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.addTag ignored: value must be a string.'
    );
  });

  it('drops an addTag without a string key', () => {
    SallaPush.User.addTag(undefined as unknown as string, 'gold');

    expect(plugin.addTag).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.addTag ignored: key must be a string.'
    );
  });

  it('drops every addTags whose tags are not a plain object, with one warning', () => {
    const notPlainObjects = [
      'level=gold',
      null,
      [['level', 'gold']],
      new Map([['level', 'gold']]),
    ];

    for (const tags of notPlainObjects) {
      SallaPush.User.addTags(tags as unknown as Record<string, string>);
    }

    expect(plugin.addTags).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.addTags ignored: tags must be a plain object.'
    );
  });

  it('drops a removeTag without a string key', () => {
    SallaPush.User.removeTag(5 as unknown as string);

    expect(plugin.removeTag).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.removeTag ignored: key must be a string.'
    );
  });

  it('drops a removeTags without an array', () => {
    SallaPush.User.removeTags('level' as unknown as string[]);

    expect(plugin.removeTags).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.removeTags ignored: keys must be an array.'
    );
  });
});

describe('SallaPush.User.setLanguage', () => {
  it('passes a language', () => {
    SallaPush.User.setLanguage('ar');

    expect(plugin.setLanguage).toHaveBeenCalledWith({ language: 'ar' });
  });

  it('passes null, which means the device language', () => {
    SallaPush.User.setLanguage(null);

    expect(plugin.setLanguage).toHaveBeenCalledWith({ language: null });
  });

  it('drops a language that is neither a string nor null', () => {
    SallaPush.User.setLanguage(undefined as unknown as string);
    SallaPush.User.setLanguage(1 as unknown as string);

    expect(plugin.setLanguage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.User.setLanguage ignored: language must be a string or null.'
    );
  });
});

describe('SallaPush.User without the native plugin', () => {
  it('prints one console error per setter, naming the public method', async () => {
    const missing = new CapacitorException(
      '"SallaPush" plugin is not implemented on web',
      ExceptionCode.Unimplemented
    );
    plugin.addTag.mockRejectedValueOnce(missing).mockRejectedValueOnce(missing);

    SallaPush.User.addTag('level', 'gold');
    SallaPush.User.addTag('city', 'riyadh');
    await flush();

    expect(plugin.addTag).toHaveBeenCalledTimes(2);
    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.User.addTag failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
  });
});

describe('SallaPush.User events', () => {
  it("passes user changes to 'change' listeners", async () => {
    const listener = jest.fn<(state: SallaPushUserChangedState) => void>();
    subscriptions.push(SallaPush.User.addEventListener('change', listener));
    await flush();

    emit('userChange', {
      previous: { isLoggedIn: false },
      current: { externalId: 'customer-7', isLoggedIn: true },
    });

    expect(plugin.startEvents).toHaveBeenCalledWith({ kind: 'user' });
    expect(listener).toHaveBeenCalledWith({
      previous: { externalId: null, isLoggedIn: false },
      current: { externalId: 'customer-7', isLoggedIn: true },
    });
  });

  it("passes login failures to 'loginFailure' listeners", async () => {
    const listener = jest.fn<(failure: SallaPushLoginFailure) => void>();
    subscriptions.push(
      SallaPush.User.addEventListener('loginFailure', listener)
    );
    await flush();

    emit('loginFailure', { failure: 'tokenRejected' });
    emit('loginFailure', { failure: 'invalidRequest' });

    expect(plugin.startEvents).toHaveBeenCalledWith({ kind: 'loginFailure' });
    expect(listener.mock.calls).toEqual([
      [SallaPushLoginFailure.TokenRejected],
      [SallaPushLoginFailure.InvalidRequest],
    ]);
  });
});
