import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { SallaPushLogLevel } from '../definitions';
import type * as Index from '../index';

// The API on Capacitor's own plugin proxy, as an app runs it: on a native platform, with the plugin's header and a
// stand-in for the native bridge that records each call when Capacitor posts it, and on the web, without either.

/** The plugin methods these tests call, as Capacitor's header lists them: only requests have the type `promise`. */
const methods = [
  { name: 'addListener' },
  { name: 'removeListener' },
  { name: 'removeAllListeners', rtype: 'promise' },
  { name: 'initialize' },
  { name: 'login' },
  { name: 'logout' },
  { name: 'optOut' },
  { name: 'addPushSubscriptionListener' },
  { name: 'removePushSubscriptionListener' },
  { name: 'setLogHandlerLevel' },
  { name: 'startEvents' },
  { name: 'stopEvents' },
];

type Options = { eventName?: string; kind?: string } | undefined;
type Callback = (data: unknown) => void;

let SallaPush: typeof Index.SallaPush;
/** The calls in the order Capacitor posted them, as `method`, `method:kind` or `addListener:eventName`. */
let posted: string[];
let callbacks: { eventName: string; callback: Callback }[];
let error: jest.SpiedFunction<typeof console.error>;

/** Lets every posted call settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Loads Capacitor and the API afresh, as a new page does: on Android's bridge, or on the web. */
function load(platform: 'android' | 'web'): void {
  const page = globalThis as Record<string, unknown>;
  delete page.androidBridge;
  delete page.Capacitor;
  if (platform === 'android') {
    page.androidBridge = { postMessage() {} };
    page.Capacitor = {
      PluginHeaders: [{ name: 'SallaPush', methods }],
      nativeCallback(
        _plugin: string,
        method: string,
        options: Options,
        callback?: Callback
      ): string {
        post(method, options);
        if (method === 'addListener' && options?.eventName && callback) {
          callbacks.push({ eventName: options.eventName, callback });
        }
        return String(posted.length);
      },
      nativePromise(
        _plugin: string,
        method: string,
        options: Options
      ): Promise<unknown> {
        post(method, options);
        return Promise.resolve({});
      },
    };
  }
  jest.resetModules();
  ({ SallaPush } = jest.requireActual<typeof Index>('../index'));
}

function post(method: string, options: Options): void {
  const detail = options?.eventName ?? options?.kind;
  posted.push(detail === undefined ? method : `${method}:${detail}`);
}

beforeEach(() => {
  posted = [];
  callbacks = [];
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

describe('on a native platform', () => {
  beforeEach(() => load('android'));

  it('every call reaches native in the order the app made it, listener registrations included', async () => {
    SallaPush.User.addEventListener('change', () => {});
    SallaPush.login('customer-7', 'token');
    SallaPush.Debug.setLogHandler(SallaPushLogLevel.Info, () => {});
    SallaPush.initialize('app_id');
    const subscription = SallaPush.User.pushSubscription.addEventListener(
      'change',
      () => {}
    );
    SallaPush.User.pushSubscription.optOut();
    subscription.remove();
    SallaPush.logout();
    await flush();

    expect(posted).toEqual([
      'addListener:userChange',
      'startEvents:user',
      'login',
      'setLogHandlerLevel',
      'addListener:log',
      'startEvents:log',
      'initialize',
      'addListener:pushSubscriptionChange',
      'addPushSubscriptionListener',
      'optOut',
      'removePushSubscriptionListener',
      'logout',
    ]);
    expect(error).not.toHaveBeenCalled();
  });

  it('the first listener gets the events of the Capacitor listener added for it', async () => {
    const listener = jest.fn();
    SallaPush.User.addEventListener('change', listener);
    await flush();

    for (const added of callbacks) {
      if (added.eventName === 'userChange') {
        added.callback({
          previous: { externalId: null, isLoggedIn: false },
          current: { externalId: 'customer-7', isLoggedIn: true },
        });
      }
    }

    expect(listener).toHaveBeenCalledWith({
      previous: { externalId: null, isLoggedIn: false },
      current: { externalId: 'customer-7', isLoggedIn: true },
    });
  });
});

describe('on the web', () => {
  beforeEach(() => load('web'));

  it('listeners and the log handler print one console error each', async () => {
    SallaPush.Notifications.addEventListener('click', () => {}).remove();
    SallaPush.Notifications.addEventListener('click', () => {});
    SallaPush.User.pushSubscription.addEventListener('change', () => {});
    SallaPush.Debug.setLogHandler(SallaPushLogLevel.Warn, () => {});
    await flush();

    // In any order: the lines are reported as the rejections settle.
    expect(error.mock.calls.map(([line]) => line).sort()).toEqual([
      '[SallaPush] SallaPush.Debug log handler failed: "SallaPush" plugin is not implemented on web',
      '[SallaPush] SallaPush.Notifications \'click\' listener failed: "SallaPush" plugin is not implemented on web',
      '[SallaPush] SallaPush.User.pushSubscription \'change\' listener failed: "SallaPush" plugin is not implemented on web',
    ]);
  });
});
