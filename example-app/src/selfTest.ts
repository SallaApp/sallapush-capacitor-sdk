import { Capacitor } from '@capacitor/core';
import {
  SallaPush,
  SallaPushIOSPermissionStatus,
  SallaPushLogLevel,
  type SallaPushEventSubscription,
  type SallaPushLogEntry,
  type SallaPushNotification,
  type SallaPushUserChangedState,
} from '@salla.sa/sallapush-capacitor';
import { eventLog, followLogs } from './eventLog';
import { SmokeReporter } from './smokeReporter';

/** The app id of the smoke configuration, a made-up id that no store app has. */
export const SMOKE_APP_ID = 'example_smoke';

const CUSTOMER_ID = 'smoke-customer';
const APNS_TOKEN = '0123456789abcdef'.repeat(4);
const EVENT_TIMEOUT_MS = 10_000;
const ANSWER_TIMEOUT_MS = 5_000;
const LEVELS: readonly string[] = Object.values(SallaPushLogLevel);
const PERMISSION_STATUSES: readonly string[] = Object.values(
  SallaPushIOSPermissionStatus
);
// The reload probe's mark in sessionStorage: the first page sets it before it reloads, and the reloaded page takes it.
const RELOAD_KEY = 'sallapush.selftest.reload';
const NO_ANSWER = Symbol('no answer');

// The test push: ios/TestPayloads/native.apns and android/TestPayloads/native.json.
const TEST_PUSH = {
  notificationId: 'msg_5a11a90001',
  title: 'SallaPush test',
  body: 'A native SallaPush notification',
  launchUrl: 'https://example.com/products/42',
  source: 'native',
  additionalData: { type: 'product', id: '42' },
};
const TEST_PUSH_DATA = {
  sp_v: '1',
  sp_id: TEST_PUSH.notificationId,
  ...TEST_PUSH.additionalData,
};

/**
 * The smoke tests' self-test, run at launch when SallaPush started with the smoke app id. It calls every API member,
 * logs `SALLAPUSH_SELFTEST {"passed":n,"failed":m,"failures":[…],"skipped":[…],"willDisplay":…}`, and, when it waits
 * for the test push, logs `SALLAPUSH_SELFTEST_WILL_DISPLAY {"ok":true}` once that push arrives in the foreground. Then
 * it reloads the page once for the reload probe, whose page logs `SALLAPUSH_SELFTEST_RELOAD {…}` (checkReloadedPage).
 */
export async function startSelfTest(): Promise<void> {
  // On the web SallaPush isn't available, and the request rejects.
  const appId = await answer(() => SallaPush.getAppId()).catch(() => null);
  if (appId !== SMOKE_APP_ID) {
    return;
  }
  if (takeReloadMark()) {
    await checkReloadedPage();
    return;
  }
  const report = new Report();
  try {
    await checkFacade(report);
    await checkNotifications(report);
    await checkUser(report);
    await checkPushSubscription(report);
    await checkDebug(report);
    await checkListeners(report);
  } catch (error) {
    report.fail('the self-test', String(error));
  }
  const willDisplay = (await waitForTestPush(reloadAfterCalls))
    ? 'waiting'
    : 'skipped: notifications are not allowed';
  print('SALLAPUSH_SELFTEST', report.result(willDisplay));
  if (willDisplay !== 'waiting') {
    reloadAfterCalls();
  }
}

async function checkFacade(report: Report): Promise<void> {
  report.equal(
    'SallaPush.isInitialized()',
    await SallaPush.isInitialized(),
    true
  );
  report.equal(
    'SallaPush.getAppId()',
    await SallaPush.getAppId(),
    SMOKE_APP_ID
  );
  const version = await SallaPush.getSdkVersion();
  report.check(
    'SallaPush.getSdkVersion()',
    /^\d+\.\d+\.\d+/.test(version),
    version
  );
  SallaPush.initialize(SMOKE_APP_ID);
  report.equal(
    'SallaPush.getAppId() after initialize() with the same app id',
    await SallaPush.getAppId(),
    SMOKE_APP_ID
  );
  SallaPush.setConsentRequired(false);
  SallaPush.setConsentGiven(true);
  report.equal(
    'SallaPush.isInitialized() after the consent calls',
    await SallaPush.isInitialized(),
    true
  );
}

async function checkNotifications(report: Report): Promise<void> {
  const notifications = SallaPush.Notifications;
  const ios = Capacitor.getPlatform() === 'ios';
  const allowedBefore = await notifications.getPermission();
  const granted = nextEvent<boolean>(
    (listener) => notifications.addEventListener('permissionChange', listener),
    (allowed) => allowed
  );
  // iOS: quiet notifications without a prompt, so the test push can arrive in the foreground.
  const provisional = await notifications.registerForProvisionalAuthorization();
  report.check(
    'Notifications.registerForProvisionalAuthorization()',
    ios ? typeof provisional === 'boolean' : provisional === false,
    provisional
  );
  const status = await notifications.getPermissionStatus();
  report.check(
    'Notifications.getPermissionStatus()',
    ios ? isOneOf(PERMISSION_STATUSES, status) : status === null,
    status
  );
  const allowed = await notifications.getPermission();
  report.check(
    'Notifications.getPermission()',
    typeof allowed === 'boolean',
    allowed
  );
  if (!allowedBefore && allowed) {
    report.check("Notifications 'permissionChange' event", await granted);
  }
  const canRequest = await notifications.canRequestPermission();
  report.check(
    'Notifications.canRequestPermission()',
    typeof canRequest === 'boolean',
    canRequest
  );
  if (allowed && (!ios || status === SallaPushIOSPermissionStatus.Authorized)) {
    report.equal(
      'Notifications.requestPermission() while allowed',
      await notifications.requestPermission(false),
      true
    );
  } else {
    report.skip('Notifications.requestPermission()', 'it would show a prompt');
  }
  notifications.refreshPermission();
  notifications.registerForRemoteNotifications();
  notifications.forwardApnsToken(APNS_TOKEN);
  notifications.clearAll();
  notifications.removeNotification(1);
  report.equal(
    'Notifications.isSallaPushNotification() for the test push',
    await notifications.isSallaPushNotification(TEST_PUSH_DATA),
    true
  );
  report.equal(
    'Notifications.isSallaPushNotification() for another payload',
    await notifications.isSallaPushNotification({ other: 'payload' }),
    false
  );
  const opened = await notifications.trackOpened({
    push_ref: TEST_PUSH.notificationId,
  });
  report.check(
    'Notifications.trackOpened()',
    ios ? opened === false : typeof opened === 'boolean',
    opened
  );
  SallaPush.Migration.setDisplayCompatPayloads(true);
}

async function checkUser(report: Report): Promise<void> {
  const user = SallaPush.User;
  const loggedIn = nextEvent<SallaPushUserChangedState>(
    (listener) => user.addEventListener('change', listener),
    (state) => state.current.externalId === CUSTOMER_ID
  );
  SallaPush.login(CUSTOMER_ID, 'smoke-identity-token');
  report.equal(
    'User.getExternalId() after login()',
    await user.getExternalId(),
    CUSTOMER_ID
  );
  report.equal(
    'User.isLoggedIn() after login()',
    await user.isLoggedIn(),
    true
  );
  report.check("User 'change' event after login()", await loggedIn);

  user.addTag('Smoke_Key', 'value');
  user.addTags({ Smoke_Second: '2', smoke_third: '3' });
  const tags = await user.getTags();
  report.equal(
    "User.getTags() after addTag('Smoke_Key', 'value')",
    tags.smoke_key,
    'value'
  );
  report.check(
    'User.getTags() after addTags()',
    tags.smoke_second === '2' && tags.smoke_third === '3',
    tags
  );
  user.removeTag('smoke_key');
  user.removeTags(['smoke_second', 'smoke_third']);
  const remaining = await user.getTags();
  report.check(
    'User.getTags() after removeTag() and removeTags()',
    ['smoke_key', 'smoke_second', 'smoke_third'].every(
      (key) => !(key in remaining)
    ),
    remaining
  );
  user.setLanguage('ar');
  user.setLanguage(null);

  SallaPush.logout();
  report.equal(
    'User.getExternalId() after logout()',
    await user.getExternalId(),
    null
  );
  report.equal(
    'User.isLoggedIn() after logout()',
    await user.isLoggedIn(),
    false
  );
}

async function checkPushSubscription(report: Report): Promise<void> {
  const subscription = SallaPush.User.pushSubscription;
  const id = await subscription.getId();
  report.check(
    'pushSubscription.getId()',
    id === null || typeof id === 'string',
    id
  );
  const token = await subscription.getToken();
  // The token is private: a failure names its type only.
  report.check(
    'pushSubscription.getToken()',
    token === null || typeof token === 'string',
    typeof token
  );
  const optedIn = await subscription.getOptedIn();
  report.check(
    'pushSubscription.getOptedIn()',
    typeof optedIn === 'boolean',
    optedIn
  );
  subscription.optOut();
  report.equal(
    'pushSubscription.getOptedIn() after optOut()',
    await subscription.getOptedIn(),
    false
  );
  subscription.optIn();
}

async function checkDebug(report: Report): Promise<void> {
  const debug = SallaPush.Debug;
  const level = await debug.getLogLevel();
  report.check('Debug.getLogLevel()', isOneOf(LEVELS, level), level);
  debug.setLogLevel(SallaPushLogLevel.Verbose);
  report.equal(
    "Debug.getLogLevel() after setLogLevel('verbose')",
    await debug.getLogLevel(),
    SallaPushLogLevel.Verbose
  );
  debug.setLogLevel(level);

  const invalidKey = nextLogEntry('tags.invalid_key');
  SallaPush.User.addTag('not a key!', 'value');
  const entry = await invalidKey;
  report.check(
    'Debug.setLogHandler() gets the entry of an invalid tag key',
    entry !== null &&
      entry.level === SallaPushLogLevel.Warn &&
      typeof entry.timestamp === 'number',
    entry
  );
  debug.setLogHandler(SallaPushLogLevel.Verbose, null);
  followLogs(eventLog.logLevel());
}

/**
 * A listener removed between two events must get the first and miss the second, which another listener still gets:
 * login() and logout() make user 'change' events here, and waitForTestPush checks a removed will-display listener.
 * The other events need a tap, a permission change, a login the server refuses or a registered device, which the smoke
 * configuration doesn't have, so their listeners are only added and removed, and reported as skipped.
 */
async function checkListeners(report: Report): Promise<void> {
  const user = SallaPush.User;
  const states: SallaPushUserChangedState[] = [];
  const subscription = user.addEventListener('change', (state) => {
    states.push(state);
  });
  const loggedIn = nextEvent<SallaPushUserChangedState>(
    (listener) => user.addEventListener('change', listener),
    (state) => state.current.isLoggedIn
  );
  SallaPush.login(CUSTOMER_ID, 'smoke-identity-token');
  report.check(
    "User 'change' listener gets the event of login() while added",
    (await loggedIn) && states.some((state) => state.current.isLoggedIn),
    states
  );
  subscription.remove();
  const received = states.length;
  const loggedOut = nextEvent<SallaPushUserChangedState>(
    (listener) => user.addEventListener('change', listener),
    (state) => !state.current.isLoggedIn
  );
  SallaPush.logout();
  report.check(
    "User 'change' listener misses the event of logout() once removed",
    (await loggedOut) && states.length === received,
    states.slice(received)
  );

  const ignore = () => {};
  const unobserved: Array<[string, string, () => SallaPushEventSubscription]> =
    [
      [
        "Notifications 'click' listener",
        'its event needs a tap',
        () => SallaPush.Notifications.addEventListener('click', ignore),
      ],
      [
        "Notifications 'permissionChange' listener",
        'its event needs a permission change',
        () =>
          SallaPush.Notifications.addEventListener('permissionChange', ignore),
      ],
      [
        "User 'loginFailure' listener",
        'its event needs a login the server refuses',
        () => user.addEventListener('loginFailure', ignore),
      ],
      [
        "User.pushSubscription 'change' listener",
        'its event needs a registered device',
        () => user.pushSubscription.addEventListener('change', ignore),
      ],
    ];
  for (const [name, reason, add] of unobserved) {
    add().remove();
    report.skip(name, reason);
  }
}

/**
 * The reload probe's page. Capacitor reset every plugin's listeners when the page reloaded, which stops every native
 * registration of the page before. Instead of the full self-test, this page checks that its calls work and listens for
 * the test push again: `SALLAPUSH_SELFTEST_RELOAD {"ok":…,"failures":[…],"willDisplay":"waiting"|"skipped: …"}`.
 */
async function checkReloadedPage(): Promise<void> {
  const report = new Report();
  let willDisplay = 'skipped: the reloaded page failed';
  try {
    report.equal(
      'SallaPush.isInitialized() after the reload',
      await answer(() => SallaPush.isInitialized()),
      true
    );
    const version = await answer(() => SallaPush.getSdkVersion());
    report.check(
      'SallaPush.getSdkVersion() after the reload',
      /^\d+\.\d+\.\d+/.test(version),
      version
    );
    willDisplay = (await waitForTestPush())
      ? 'waiting'
      : 'skipped: notifications are not allowed';
  } catch (error) {
    report.fail('the reloaded page', String(error));
  }
  print('SALLAPUSH_SELFTEST_RELOAD', report.reloadResult(willDisplay));
}

/**
 * Listens for the test push while the app is in the foreground; false when notifications can't be shown. A listener
 * removed before the push must not get it. `afterPush` runs once the line about the push is logged.
 */
async function waitForTestPush(afterPush?: () => void): Promise<boolean> {
  if (!(await SallaPush.Notifications.getPermission())) {
    return false;
  }
  let removedListenerRan = false;
  SallaPush.Notifications.addEventListener('foregroundWillDisplay', () => {
    removedListenerRan = true;
  }).remove();
  const subscription = SallaPush.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event) => {
      subscription.remove();
      const failures = testPushFailures(event.notification);
      if (removedListenerRan) {
        failures.push(
          "a 'foregroundWillDisplay' listener removed before the push got it"
        );
      }
      print(
        'SALLAPUSH_SELFTEST_WILL_DISPLAY',
        failures.length === 0 ? { ok: true } : { ok: false, failures }
      );
      afterPush?.();
    }
  );
  // Calls reach native in order: once this resolves, the native listener is registered.
  await SallaPush.isInitialized();
  return true;
}

function testPushFailures(notification: SallaPushNotification): string[] {
  const failures: string[] = [];
  const expect = (name: string, actual: unknown, expected: unknown) => {
    if (!Object.is(actual, expected)) {
      failures.push(
        `${name}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
      );
    }
  };
  expect(
    'notificationId',
    notification.notificationId,
    TEST_PUSH.notificationId
  );
  expect('title', notification.title, TEST_PUSH.title);
  expect('body', notification.body, TEST_PUSH.body);
  expect('launchUrl', notification.launchUrl, TEST_PUSH.launchUrl);
  expect('source', notification.source, TEST_PUSH.source);
  for (const [key, value] of Object.entries(TEST_PUSH.additionalData)) {
    expect(`additionalData.${key}`, notification.additionalData[key], value);
  }
  expect("getString('type')", notification.getString('type'), 'product');
  expect("getString('id')", notification.getString('id'), '42');
  expect("getInt('id')", notification.getInt('id'), 42);
  expect("getInt('type')", notification.getInt('type'), null);
  expect("getBool('id')", notification.getBool('id'), null);
  expect(
    "getNumber('id')",
    notification.getNumber('id'),
    Capacitor.getPlatform() === 'ios' ? 42 : null
  );
  return failures;
}

/**
 * Reloads the page for the reload probe once the calls made so far reached native: they reach it in order, and this
 * request is answered after them, so a will-display decision and the logged line get there before Capacitor resets the
 * plugins. When sessionStorage can't keep the probe's mark, the page reports the probe as failed and doesn't reload, so
 * the probe can never loop.
 */
function reloadAfterCalls(): void {
  // After the current listener, so a will-display decision is sent first.
  setTimeout(() => {
    SallaPush.isInitialized().then(reload, reload);
  }, 0);
}

function reload(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, '1');
    if (sessionStorage.getItem(RELOAD_KEY) !== '1') {
      throw new Error('the mark was not kept');
    }
  } catch (error) {
    print('SALLAPUSH_SELFTEST_RELOAD', {
      ok: false,
      failures: [`sessionStorage: ${String(error)}`],
      willDisplay: 'skipped: the page did not reload',
    });
    return;
  }
  location.reload();
}

/** True on the page the reload probe loaded. The mark is removed as it is found, so the probe reloads only once. */
function takeReloadMark(): boolean {
  let found = false;
  try {
    found = sessionStorage.getItem(RELOAD_KEY) !== null;
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // Without sessionStorage the first page doesn't reload either.
  }
  return found;
}

/**
 * Asks again once when a request isn't answered within 5 s. Capacitor Android 8.5 keeps a page's reply channel only
 * after it dispatched that page's first call, so the answer to a reloaded page's first call can go to the page before.
 */
async function answer<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await Promise.race([
      request(),
      new Promise<typeof NO_ANSWER>((resolve) =>
        setTimeout(() => resolve(NO_ANSWER), ANSWER_TIMEOUT_MS)
      ),
    ]);
    if (result !== NO_ANSWER) {
      return result;
    }
  }
  throw new Error(`no answer within ${ANSWER_TIMEOUT_MS} ms, twice`);
}

/** Resolves true when `listen` delivers a matching value within the timeout, then stops listening. */
function nextEvent<Value>(
  listen: (listener: (value: Value) => void) => SallaPushEventSubscription,
  matches: (value: Value) => boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (arrived: boolean) => {
      clearTimeout(timer);
      subscription.remove();
      resolve(arrived);
    };
    const timer = setTimeout(() => finish(false), EVENT_TIMEOUT_MS);
    const subscription = listen((value) => {
      if (matches(value)) {
        finish(true);
      }
    });
  });
}

/** Sets a log handler at verbose and resolves with the first entry with `code`, or null after the timeout. */
function nextLogEntry(code: string): Promise<SallaPushLogEntry | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), EVENT_TIMEOUT_MS);
    SallaPush.Debug.setLogHandler(SallaPushLogLevel.Verbose, (entry) => {
      if (entry.code === code) {
        clearTimeout(timer);
        resolve(entry);
      }
    });
  });
}

function isOneOf(values: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && values.includes(value);
}

/**
 * Logs a self-test line to the console and, through the example's SmokeReporter plugin, to the native log, which the
 * smoke tests read: release builds don't forward the console.
 */
function print(marker: string, value: object): void {
  const line = `${marker} ${JSON.stringify(value)}`;
  console.info(line);
  SmokeReporter.report({ line }).catch(() => undefined);
}

class Report {
  private passed = 0;
  private readonly failures: string[] = [];
  private readonly skipped: string[] = [];

  equal(name: string, actual: unknown, expected: unknown): void {
    this.check(name, Object.is(actual, expected), actual);
  }

  check(name: string, passed: boolean, actual?: unknown): void {
    if (passed) {
      this.passed += 1;
    } else {
      this.fail(name, `got ${JSON.stringify(actual)}`);
    }
  }

  fail(name: string, reason: string): void {
    this.failures.push(`${name}: ${reason}`);
  }

  skip(name: string, reason: string): void {
    this.skipped.push(`${name}: ${reason}`);
  }

  result(willDisplay: string): object {
    return {
      passed: this.passed,
      failed: this.failures.length,
      failures: this.failures,
      skipped: this.skipped,
      willDisplay,
    };
  }

  reloadResult(willDisplay: string): object {
    return {
      ok: this.failures.length === 0,
      failures: this.failures,
      willDisplay,
    };
  }
}
