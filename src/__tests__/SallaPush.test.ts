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
import {
  SallaPush,
  SallaPushAPNsEnvironment,
  SallaPushLogLevel,
  type SallaPushConfig,
} from '../index';

jest.mock('../internal/native');

const plugin = jest.mocked(native);
let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;

/** Lets the rejections of sent calls reach their handlers. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What Capacitor's proxy rejects every call with when the native plugin is missing, as on the web. */
const missing = () =>
  new CapacitorException(
    '"SallaPush" plugin is not implemented on web',
    ExceptionCode.Unimplemented
  );

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
});

describe('SallaPush.initialize', () => {
  it('passes the app id and every option', () => {
    SallaPush.initialize('st_42_capacitor', {
      apiBaseUrl: 'https://push.example.com/notifications/v1/sallapush',
      logLevel: SallaPushLogLevel.Debug,
      appVersion: '2.1.0',
      clearTagsOnLogout: false,
      requiresUserConsent: true,
      openLaunchUrls: true,
      autoClearBadge: false,
      autoUpdateBadge: false,
      ios: {
        appGroupIdentifier: 'group.sa.salla.example',
        apnsEnvironment: SallaPushAPNsEnvironment.Sandbox,
        autoClearBadge: false,
        registerForRemoteNotificationsOnInit: false,
      },
    });

    expect(plugin.initialize).toHaveBeenCalledTimes(1);
    expect(plugin.initialize).toHaveBeenCalledWith({
      appId: 'st_42_capacitor',
      config: {
        apiBaseUrl: 'https://push.example.com/notifications/v1/sallapush',
        logLevel: 'debug',
        appVersion: '2.1.0',
        clearTagsOnLogout: false,
        requiresUserConsent: true,
        openLaunchUrls: true,
        autoClearBadge: false,
        autoUpdateBadge: false,
        iosAppGroupIdentifier: 'group.sa.salla.example',
        iosApnsEnvironment: 'sandbox',
        iosAutoClearBadge: false,
        iosRegisterForRemoteNotificationsOnInit: false,
      },
    });
  });

  // Each boolean alone, at the value that isn't native's default, so options swapped with each other can't pass.
  it.each<[SallaPushConfig, Record<string, boolean>]>([
    [{ clearTagsOnLogout: false }, { clearTagsOnLogout: false }],
    [{ requiresUserConsent: true }, { requiresUserConsent: true }],
    [{ openLaunchUrls: true }, { openLaunchUrls: true }],
    [{ autoClearBadge: false }, { autoClearBadge: false }],
    [{ autoUpdateBadge: false }, { autoUpdateBadge: false }],
    [{ ios: { autoClearBadge: false } }, { iosAutoClearBadge: false }],
    [
      { ios: { registerForRemoteNotificationsOnInit: false } },
      { iosRegisterForRemoteNotificationsOnInit: false },
    ],
  ])('passes %j as %j, and no other option', (config, spec) => {
    SallaPush.initialize('st_42_capacitor', config);

    expect(plugin.initialize.mock.calls).toEqual([
      [{ appId: 'st_42_capacitor', config: spec }],
    ]);
  });

  // The bridges decide between them: iOS takes autoClearBadge first, and Android never reads the iOS option.
  it('passes the deprecated ios.autoClearBadge beside autoClearBadge', () => {
    SallaPush.initialize('st_42_capacitor', {
      autoClearBadge: true,
      ios: { autoClearBadge: false },
    });

    expect(plugin.initialize.mock.calls).toEqual([
      [
        {
          appId: 'st_42_capacitor',
          config: { autoClearBadge: true, iosAutoClearBadge: false },
        },
      ],
    ]);
  });

  it('passes no options without a config', () => {
    SallaPush.initialize('st_42_capacitor');

    expect(plugin.initialize).toHaveBeenCalledWith({
      appId: 'st_42_capacitor',
      config: {},
    });
  });

  it('leaves out options that are undefined or null, so native keeps its defaults', () => {
    SallaPush.initialize('st_42_capacitor', {
      logLevel: undefined,
      appVersion: null,
      openLaunchUrls: true,
      ios: { apnsEnvironment: SallaPushAPNsEnvironment.Production },
    } as unknown as SallaPushConfig);

    // Strict: an option left as undefined would still reach native as a key.
    expect(plugin.initialize.mock.calls[0]?.[0]).toStrictEqual({
      appId: 'st_42_capacitor',
      config: { openLaunchUrls: true, iosApnsEnvironment: 'production' },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('passes the app id unchanged, for native to validate', () => {
    SallaPush.initialize(' st_42 capacitor ');

    expect(plugin.initialize).toHaveBeenCalledWith({
      appId: ' st_42 capacitor ',
      config: {},
    });
  });

  it('drops a call whose app id is not a string, with one warning', () => {
    SallaPush.initialize(42 as unknown as string);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.initialize ignored: appId must be a string.'
    );
  });

  it('drops a call whose config is not a plain object', () => {
    SallaPush.initialize('st_42_capacitor', [
      'debug',
    ] as unknown as SallaPushConfig);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.initialize ignored: config must be a plain object.'
    );
  });

  it('drops a call with an unknown log level', () => {
    SallaPush.initialize('st_42_capacitor', {
      logLevel: 'Debug',
    } as unknown as SallaPushConfig);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[SallaPush] SallaPush.initialize ignored: config.logLevel must be one of 'off', 'error', 'warn', " +
        "'info', 'debug', 'verbose'."
    );
  });

  it('drops a call with a mistyped option', () => {
    SallaPush.initialize('st_42_capacitor', {
      requiresUserConsent: 'true',
    } as unknown as SallaPushConfig);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.initialize ignored: config.requiresUserConsent must be a boolean.'
    );
  });

  it.each(['autoClearBadge', 'autoUpdateBadge'])(
    'drops a call whose %s is not a boolean',
    (option) => {
      SallaPush.initialize('st_42_capacitor', {
        [option]: 'false',
      } as unknown as SallaPushConfig);

      expect(plugin.initialize).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        `[SallaPush] SallaPush.initialize ignored: config.${option} must be a boolean.`
      );
    }
  );

  it('drops a call whose iOS options are not an object', () => {
    SallaPush.initialize('st_42_capacitor', {
      ios: 'sandbox',
    } as unknown as SallaPushConfig);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.initialize ignored: config.ios must be a plain object.'
    );
  });

  it('drops a call with an unknown APNs environment', () => {
    SallaPush.initialize('st_42_capacitor', {
      ios: { apnsEnvironment: 'development' },
    } as unknown as SallaPushConfig);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[SallaPush] SallaPush.initialize ignored: config.ios.apnsEnvironment must be one of 'automatic', " +
        "'sandbox', 'production'."
    );
  });

  it('warns once per method and parameter, and drops every such call', () => {
    const config = { ios: { autoClearBadge: 1 } } as unknown as SallaPushConfig;

    SallaPush.initialize('st_42_capacitor', config);
    SallaPush.initialize('st_42_capacitor', config);

    expect(plugin.initialize).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.initialize ignored: config.ios.autoClearBadge must be a boolean.'
    );
  });
});

describe('SallaPush getters', () => {
  it('resolve the values native reads at call time', async () => {
    plugin.isInitialized.mockResolvedValueOnce({ value: true });
    plugin.getSallaPushAppId.mockResolvedValueOnce({
      value: 'st_42_capacitor',
    });
    plugin.getSdkVersion.mockResolvedValueOnce({ value: '1.0.3' });

    await expect(SallaPush.isInitialized()).resolves.toBe(true);
    await expect(SallaPush.getAppId()).resolves.toBe('st_42_capacitor');
    await expect(SallaPush.getSdkVersion()).resolves.toBe('1.0.3');
    expect(plugin.getSallaPushAppId).toHaveBeenCalledWith();
  });

  it('resolve native null before initialization', async () => {
    await expect(SallaPush.isInitialized()).resolves.toBe(false);
    await expect(SallaPush.getAppId()).resolves.toBeNull();
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
    const rejection = missing();
    plugin.isInitialized.mockRejectedValueOnce(rejection);
    plugin.getSallaPushAppId.mockRejectedValueOnce(rejection);
    plugin.getSdkVersion.mockRejectedValueOnce(rejection);

    await expect(SallaPush.isInitialized()).rejects.toBe(rejection);
    await expect(SallaPush.getAppId()).rejects.toBe(rejection);
    await expect(SallaPush.getSdkVersion()).rejects.toBe(rejection);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('SallaPush consent', () => {
  it.each([true, false])('passes setConsentRequired(%s)', (required) => {
    SallaPush.setConsentRequired(required);

    expect(plugin.setConsentRequired).toHaveBeenCalledWith({ required });
  });

  it.each([true, false])('passes setConsentGiven(%s)', (given) => {
    SallaPush.setConsentGiven(given);

    expect(plugin.setConsentGiven).toHaveBeenCalledWith({ given });
  });

  it('drops consent calls that are not booleans', () => {
    SallaPush.setConsentRequired('true' as unknown as boolean);
    SallaPush.setConsentGiven(1 as unknown as boolean);

    expect(plugin.setConsentRequired).not.toHaveBeenCalled();
    expect(plugin.setConsentGiven).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.setConsentRequired ignored: required must be a boolean.',
      ],
      [
        '[SallaPush] SallaPush.setConsentGiven ignored: given must be a boolean.',
      ],
    ]);
  });
});

describe('SallaPush identity', () => {
  it('passes both login arguments untrimmed, for native to normalise', () => {
    SallaPush.login(' customer-7 ', ' token ');

    expect(plugin.login).toHaveBeenCalledWith({
      externalId: ' customer-7 ',
      identityToken: ' token ',
    });
  });

  it('drops a login with a numeric external id', () => {
    SallaPush.login(7 as unknown as string, 'token');

    expect(plugin.login).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.login ignored: externalId must be a string.'
    );
  });

  it('drops a login without an identity token', () => {
    (SallaPush.login as (externalId: string) => void)('customer-7');

    expect(plugin.login).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[SallaPush] SallaPush.login ignored: identityToken must be a string.'
    );
  });

  it('passes logout', () => {
    SallaPush.logout();

    expect(plugin.logout).toHaveBeenCalledTimes(1);
    expect(plugin.logout).toHaveBeenCalledWith();
  });
});

describe('SallaPush without the native plugin', () => {
  it('prints one console error per setter, naming the public method', async () => {
    plugin.logout
      .mockRejectedValueOnce(missing())
      .mockRejectedValueOnce(missing());
    plugin.setConsentGiven.mockRejectedValueOnce(missing());

    SallaPush.logout();
    SallaPush.logout();
    SallaPush.setConsentGiven(true);
    await flush();

    expect(plugin.logout).toHaveBeenCalledTimes(2);
    expect(error.mock.calls).toEqual([
      [
        '[SallaPush] SallaPush.logout failed: "SallaPush" plugin is not implemented on web',
      ],
      [
        '[SallaPush] SallaPush.setConsentGiven failed: "SallaPush" plugin is not implemented on web',
      ],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });
});
