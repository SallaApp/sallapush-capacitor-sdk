'use strict';

var core = require('@capacitor/core');

/** Where the wrapper's own JavaScript lines go: the app's console, which is the WebView console. */
const output = console;
const reported = new Set();
/** Writes a `[SallaPush]` warning the first time `key` comes up in this JavaScript runtime. */
function warnOnce(key, message) {
    if (reported.has(key)) {
        return;
    }
    reported.add(key);
    output.warn(`[SallaPush] ${message}`);
}
/** Writes a `[SallaPush]` error the first time `key` comes up in this JavaScript runtime. */
function errorOnce(key, message) {
    if (reported.has(key)) {
        return;
    }
    reported.add(key);
    output.error(`[SallaPush] ${message}`);
}

/**
 * Sends a call nobody awaits: the public API's void methods. Only a missing native plugin (the web, or an app built
 * without npx cap sync) makes it fail, which is reported once per method; native itself never fails a call.
 */
function send(method, call) {
    try {
        call().catch((error) => reportFailure(method, error));
    }
    catch (error) {
        reportFailure(method, error);
    }
}
/** The value of a request. A missing native plugin rejects it with Capacitor's UNIMPLEMENTED error, as it should. */
async function value(result) {
    return (await result).value;
}
/** The value of a request whose native answer may be null or absent. */
async function nullable$1(result) {
    var _a;
    return (_a = (await result).value) !== null && _a !== void 0 ? _a : null;
}
/** One console error per method: "[SallaPush] SallaPush.login failed: "SallaPush" plugin is not implemented on web". */
function reportFailure(method, error) {
    errorOnce(`call:${method}`, `${method} failed: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * The native SallaPush plugin. On a platform without it (the web, or an app that wasn't synced with npx cap sync)
 * every call rejects with Capacitor's UNIMPLEMENTED error.
 */
const native = core.registerPlugin('SallaPush');

/** SallaPush's log levels, from the quietest. */
const SallaPushLogLevel = {
    Off: 'off',
    Error: 'error',
    Warn: 'warn',
    Info: 'info',
    Debug: 'debug',
    Verbose: 'verbose',
};
/** The APNs environment SallaPush registers the iOS device token for. */
const SallaPushAPNsEnvironment = {
    Automatic: 'automatic',
    Sandbox: 'sandbox',
    Production: 'production',
};
/** iOS's notification authorization status. */
const SallaPushIOSPermissionStatus = {
    NotDetermined: 'notDetermined',
    Denied: 'denied',
    Authorized: 'authorized',
    Provisional: 'provisional',
    Ephemeral: 'ephemeral',
};
/** Why SallaPush's server refused the current login. */
const SallaPushLoginFailure = {
    /**
     * push-service refused the token for this external id: it expired, was revoked or is another customer's, it has a
     * Bearer prefix, or Salla couldn't check it. Call login again when the app next refreshes the token or at the next
     * launch, never from the loginFailure listener.
     */
    TokenRejected: 'tokenRejected',
    /** The login request was refused; it is not sent again. */
    InvalidRequest: 'invalidRequest',
};
/** The format a notification arrived in: SallaPush's own, or the OneSignal-compatible one used while apps migrate. */
const SallaPushPayloadSource = {
    Native: 'native',
    Compat: 'compat',
};

const string = {
    test: (value) => typeof value === 'string',
    expected: 'a string',
};
const boolean = {
    test: (value) => typeof value === 'boolean',
    expected: 'a boolean',
};
// Native takes a Java int: a fraction or a larger number would reach it as another notification's id.
const integer = {
    test: (value) => typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= -2147483648 &&
        value <= 2147483647,
    expected: 'a 32-bit integer',
};
const func = {
    test: (value) => typeof value === 'function',
    expected: 'a function',
};
const record = { test: isRecord, expected: 'a plain object' };
const array = { test: Array.isArray, expected: 'an array' };
function oneOf(values) {
    return {
        test: (value) => typeof value === 'string' && values.includes(value),
        expected: `one of ${values.map((value) => `'${value}'`).join(', ')}`,
    };
}
const logLevel = oneOf(Object.values(SallaPushLogLevel));
const apnsEnvironment = oneOf(Object.values(SallaPushAPNsEnvironment));
/** The rule for an argument that may be null. */
function nullable(rule) {
    return {
        test: (value) => value === null || rule.test(value),
        expected: `${rule.expected} or null`,
    };
}
/** The rule for an argument that may be left out: undefined and null pass. */
function optional(rule) {
    return {
        test: (value) => value === undefined || value === null || rule.test(value),
        expected: rule.expected,
    };
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
/**
 * Whether every argument passes its rule, in order. The bridges would crash or throw on a mistyped argument, so the
 * caller drops a call that fails, and the first failing parameter is reported once per runtime, as native reports
 * `api.invalid_argument`.
 */
function valid(method, args) {
    for (const [parameter, [value, rule]] of Object.entries(args)) {
        if (!rule.test(value)) {
            warnOnce(`${method}(${parameter})`, `${method} ignored: ${parameter} must be ${rule.expected}.`);
            return false;
        }
    }
    return true;
}

/**
 * A notification as native sent it, with typed getters that read the results of native's own accessors. `handle` names
 * the notification native holds for a will-display event, and `isPrevented` that event's decision; display() shows it
 * once it is prevented.
 */
function notification(spec, handle, isPrevented) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return Object.freeze({
        notificationId: (_a = spec.notificationId) !== null && _a !== void 0 ? _a : null,
        title: (_b = spec.title) !== null && _b !== void 0 ? _b : null,
        subtitle: (_c = spec.subtitle) !== null && _c !== void 0 ? _c : null,
        body: (_d = spec.body) !== null && _d !== void 0 ? _d : null,
        imageUrl: (_e = spec.imageUrl) !== null && _e !== void 0 ? _e : null,
        launchUrl: (_f = spec.launchUrl) !== null && _f !== void 0 ? _f : null,
        additionalData: spec.additionalData,
        rawPayload: spec.rawPayload,
        source: spec.source,
        sound: (_g = spec.sound) !== null && _g !== void 0 ? _g : null,
        badge: (_h = spec.badge) !== null && _h !== void 0 ? _h : null,
        threadId: (_j = spec.threadId) !== null && _j !== void 0 ? _j : null,
        androidNotificationId: (_k = spec.androidNotificationId) !== null && _k !== void 0 ? _k : null,
        collapseId: (_l = spec.collapseId) !== null && _l !== void 0 ? _l : null,
        channelId: (_m = spec.channelId) !== null && _m !== void 0 ? _m : null,
        getString: (key) => typedValue('getString', spec.stringValues, key),
        getInt: (key) => typedValue('getInt', spec.intValues, key),
        getBool: (key) => typedValue('getBool', spec.boolValues, key),
        getNumber: (key) => typedValue('getNumber', spec.numberValues, key),
        display: () => display(handle, isPrevented),
    });
}
/** A will-display event: its notification holds the handle, and preventDefault() is the listeners' decision. */
function willDisplayEvent(spec) {
    let prevented = false;
    return Object.freeze({
        notification: notification(spec.notification, spec.handle, () => prevented),
        get isPrevented() {
            return prevented;
        },
        preventDefault() {
            prevented = true;
        },
    });
}
function clickEvent(spec) {
    var _a, _b;
    return Object.freeze({
        notification: notification(spec.notification),
        result: Object.freeze({
            actionId: (_a = spec.actionId) !== null && _a !== void 0 ? _a : null,
            url: (_b = spec.url) !== null && _b !== void 0 ? _b : null,
        }),
    });
}
function permissionChange(spec) {
    return spec.permission;
}
function userChange(spec) {
    return Object.freeze({
        previous: userState(spec.previous),
        current: userState(spec.current),
    });
}
function loginFailure(spec) {
    return spec.failure;
}
function subscriptionChange(spec) {
    return Object.freeze({
        previous: subscriptionState(spec.previous),
        current: subscriptionState(spec.current),
    });
}
function logEntry(spec) {
    return Object.freeze({
        level: spec.level,
        category: spec.category,
        code: spec.code,
        message: spec.message,
        metadata: spec.metadata,
        timestamp: spec.timestamp,
    });
}
function userState(spec) {
    var _a;
    return Object.freeze({
        externalId: (_a = spec.externalId) !== null && _a !== void 0 ? _a : null,
        isLoggedIn: spec.isLoggedIn,
    });
}
function subscriptionState(spec) {
    var _a, _b;
    return Object.freeze({
        id: (_a = spec.id) !== null && _a !== void 0 ? _a : null,
        token: (_b = spec.token) !== null && _b !== void 0 ? _b : null,
        optedIn: spec.optedIn,
    });
}
// As native, display() refuses a notification that wasn't prevented: native showed it, or a later listener may still
// prevent it.
function display(handle, isPrevented) {
    if (handle !== undefined && (isPrevented === null || isPrevented === void 0 ? void 0 : isPrevented()) === true) {
        send('SallaPushNotification.display', () => native.displayNotification({ handle }));
    }
    else if (handle !== undefined) {
        warnOnce('SallaPushNotification.display.notPrevented', 'SallaPushNotification.display() did nothing: it was not prevented. Call event.preventDefault() first.');
    }
    else {
        warnOnce('SallaPushNotification.display', "SallaPushNotification.display() does nothing here: it shows only the notification of a 'foregroundWillDisplay' " +
            'event.');
    }
}
/** Native's accessor result for `key`; null when native had none, and for keys inherited from Object.prototype. */
function typedValue(getter, values, key) {
    if (!valid(`SallaPushNotification.${getter}`, { key: [key, string] })) {
        return null;
    }
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
}

/** What a dropped addEventListener call returns. */
const inert = Object.freeze({ remove() { } });
/** The push-subscription listeners and the log handler, as console lines name them. */
const SUBSCRIPTION_LISTENER = "SallaPush.User.pushSubscription 'change' listener";
const LOG_HANDLER = 'SallaPush.Debug log handler';
/**
 * A hub's one Capacitor listener, added by the first registration that needs it and kept for the page's lifetime:
 * Capacitor drops every listener when the WebView loads a page, together with the JavaScript that added it.
 */
class Connection {
    constructor(connect, dispatch) {
        this.connect = connect;
        this.dispatch = dispatch;
        this.connected = null;
    }
    // Added once; a failed add (no native plugin) is tried again by the next registration that needs it.
    open() {
        var _a;
        (_a = this.connected) !== null && _a !== void 0 ? _a : (this.connected = this.connect(this.dispatch).catch((error) => {
            this.connected = null;
            throw error;
        }));
        return this.connected;
    }
}
/**
 * The listeners of one event kind, behind one native registration. Every native call goes out at once, so it reaches
 * native in the order of the app's calls: Capacitor posts plugin calls in call order, and native runs them in that
 * order. The first listener adds the Capacitor listener, then starts the native registration, so the events native
 * delivers at once (the taps kept from a cold start) reach it. The last removal stops the native registration; the
 * Capacitor listener stays, so the listener bookkeeping of Capacitor changes only once per event and page.
 */
class EventHub {
    constructor(options) {
        this.listeners = new Set();
        this.kind = options.kind;
        this.name = options.name;
        this.map = options.map;
        this.decide = options.decide;
        this.connection = new Connection(options.connect, (payload) => this.dispatch(payload));
    }
    add(listener) {
        if (!this.listeners.has(listener)) {
            this.listeners.add(listener);
            if (this.listeners.size === 1) {
                send(this.name, () => this.connection.open());
                send(this.name, () => native.startEvents({ kind: this.kind }));
            }
        }
        return { remove: () => this.remove(listener) };
    }
    // Events already on their way then reach no listener, and are dropped, or decided.
    remove(listener) {
        if (!this.listeners.delete(listener) || this.listeners.size > 0) {
            return;
        }
        send(this.name, () => native.stopEvents({ kind: this.kind }));
    }
    // A snapshot: a listener removed by another one during the dispatch still gets this event.
    dispatch(payload) {
        var _a;
        const value = this.map(payload);
        for (const listener of [...this.listeners]) {
            deliver(listener, value, this.name);
        }
        (_a = this.decide) === null || _a === void 0 ? void 0 : _a.call(this, value, payload);
    }
}
/**
 * The push-subscription listeners. Each one has its own native observer, so each gets native's own replay: the first
 * listener adds the Capacitor listener, every listener then registers its id natively, and an event reaches only the
 * listener whose id it carries.
 */
class SubscriptionHub {
    constructor() {
        this.ids = new Map();
        this.listeners = new Map();
        this.connection = new Connection((dispatch) => native.addListener('pushSubscriptionChange', dispatch), (payload) => this.dispatch(payload));
        this.nextId = 1;
    }
    add(listener) {
        if (!this.ids.has(listener)) {
            const id = this.nextId++;
            this.ids.set(listener, id);
            this.listeners.set(id, listener);
            send(SUBSCRIPTION_LISTENER, () => this.connection.open());
            send(SUBSCRIPTION_LISTENER, () => native.addPushSubscriptionListener({ listenerId: id }));
        }
        return { remove: () => this.remove(listener) };
    }
    remove(listener) {
        const id = this.ids.get(listener);
        if (id === undefined) {
            return;
        }
        this.ids.delete(listener);
        this.listeners.delete(id);
        send(SUBSCRIPTION_LISTENER, () => native.removePushSubscriptionListener({ listenerId: id }));
    }
    dispatch(payload) {
        const listener = this.listeners.get(payload.listenerId);
        if (listener) {
            deliver(listener, subscriptionChange(payload), SUBSCRIPTION_LISTENER);
        }
    }
}
/**
 * The app's one log handler. Its level reaches native before the native registration starts, so native registers at
 * it, and a later level only changes that registration. Removing the handler stops the registration; the Capacitor
 * listener stays for the page.
 */
class LogHandlerHub {
    constructor() {
        this.handler = null;
        this.connection = new Connection((dispatch) => native.addListener('log', dispatch), (payload) => this.dispatch(payload));
    }
    set(level, handler) {
        if (handler === null) {
            if (this.handler !== null) {
                this.handler = null;
                send(LOG_HANDLER, () => native.stopEvents({ kind: 'log' }));
            }
            return;
        }
        send(LOG_HANDLER, () => native.setLogHandlerLevel({ level }));
        if (this.handler === null) {
            send(LOG_HANDLER, () => this.connection.open());
            send(LOG_HANDLER, () => native.startEvents({ kind: 'log' }));
        }
        this.handler = handler;
    }
    dispatch(payload) {
        if (this.handler !== null) {
            deliver(this.handler, logEntry(payload), LOG_HANDLER);
        }
    }
}
/**
 * Adds `listener` to the hub of `event`. A call with an unknown event or a listener that isn't a function is dropped
 * with one warning, and returns a subscription that does nothing.
 */
function addListener(method, hubs, event, listener) {
    const hub = hubFor(method, hubs, event, listener);
    return hub ? hub.add(listener) : inert;
}
/** Removes `listener` from the hub of `event`; a call with an unknown event or a non-function listener is dropped. */
function removeListener(method, hubs, event, listener) {
    var _a;
    (_a = hubFor(method, hubs, event, listener)) === null || _a === void 0 ? void 0 : _a.remove(listener);
}
function hubFor(method, hubs, event, listener) {
    if (!valid(method, {
        event: [event, oneOf(Object.keys(hubs))],
        listener: [listener, func],
    })) {
        return undefined;
    }
    return hubs[event];
}
/** Calls one listener; an exception it throws is reported, and doesn't reach the other listeners or native. */
function deliver(listener, value, name) {
    try {
        listener(value);
    }
    catch (error) {
        console.error(`[SallaPush] A ${name} threw:`, error);
    }
}

const logHandler = new LogHandlerHub();
const Debug = {
    getLogLevel: () => value(native.getLogLevel()),
    setLogLevel(level) {
        if (valid('SallaPush.Debug.setLogLevel', { level: [level, logLevel] })) {
            send('SallaPush.Debug.setLogLevel', () => native.setLogLevel({ level }));
        }
    },
    setLogHandler(level, handler) {
        if (valid('SallaPush.Debug.setLogHandler', {
            level: [level, logLevel],
            handler: [handler, nullable(func)],
        })) {
            logHandler.set(level, handler);
        }
    },
};

const Migration = {
    setDisplayOneSignalCompatPayloads(display) {
        if (valid('SallaPush.Migration.setDisplayOneSignalCompatPayloads', {
            display: [display, boolean],
        })) {
            send('SallaPush.Migration.setDisplayOneSignalCompatPayloads', () => native.setDisplayOneSignalCompatPayloads({ display }));
        }
    },
};

const willDisplay = "SallaPush.Notifications 'foregroundWillDisplay' listener";
const hubs$2 = {
    click: new EventHub({
        kind: 'click',
        name: "SallaPush.Notifications 'click' listener",
        connect: (dispatch) => native.addListener('click', dispatch),
        map: clickEvent,
    }),
    // Native holds each notification until JavaScript decides: shown, unless a listener prevented it.
    foregroundWillDisplay: new EventHub({
        kind: 'willDisplay',
        name: willDisplay,
        connect: (dispatch) => native.addListener('willDisplay', dispatch),
        map: willDisplayEvent,
        decide: (event, payload) => {
            if (!event.isPrevented) {
                send(willDisplay, () => native.displayNotification({ handle: payload.handle }));
            }
        },
    }),
    permissionChange: new EventHub({
        kind: 'permission',
        name: "SallaPush.Notifications 'permissionChange' listener",
        connect: (dispatch) => native.addListener('permissionChange', dispatch),
        map: permissionChange,
    }),
};
// A dropped promise-returning call resolves false, the neutral value of a platform-only call.
const Notifications = {
    getPermission: () => value(native.getPermission()),
    canRequestPermission: () => value(native.canRequestPermission()),
    getPermissionStatus: () => nullable$1(native.getPermissionStatus()),
    requestPermission(fallbackToSettings) {
        if (!valid('SallaPush.Notifications.requestPermission', {
            fallbackToSettings: [fallbackToSettings, optional(boolean)],
        })) {
            return Promise.resolve(false);
        }
        return value(native.requestPermission({
            fallbackToSettings: fallbackToSettings !== null && fallbackToSettings !== void 0 ? fallbackToSettings : false,
        }));
    },
    registerForProvisionalAuthorization: () => value(native.registerForProvisionalAuthorization()),
    refreshPermission: () => send('SallaPush.Notifications.refreshPermission', () => native.refreshPermission()),
    registerForRemoteNotifications: () => send('SallaPush.Notifications.registerForRemoteNotifications', () => native.registerForRemoteNotifications()),
    forwardApnsToken(apnsToken) {
        if (valid('SallaPush.Notifications.forwardApnsToken', {
            apnsToken: [apnsToken, string],
        })) {
            send('SallaPush.Notifications.forwardApnsToken', () => native.forwardApnsToken({ apnsToken }));
        }
    },
    clearAll: () => send('SallaPush.Notifications.clearAll', () => native.clearAll()),
    removeNotification(androidNotificationId) {
        if (valid('SallaPush.Notifications.removeNotification', {
            androidNotificationId: [androidNotificationId, integer],
        })) {
            send('SallaPush.Notifications.removeNotification', () => native.removeNotification({ androidNotificationId }));
        }
    },
    isSallaPushNotification(payload) {
        if (!valid('SallaPush.Notifications.isSallaPushNotification', {
            payload: [payload, record],
        })) {
            return Promise.resolve(false);
        }
        return value(native.isSallaPushNotification({ payload }));
    },
    trackOpened(additionalData) {
        if (!valid('SallaPush.Notifications.trackOpened', {
            additionalData: [additionalData, nullable(record)],
        })) {
            return Promise.resolve(false);
        }
        return value(native.trackOpened({ additionalData }));
    },
    addEventListener: (event, listener) => addListener('SallaPush.Notifications.addEventListener', hubs$2, event, listener),
    removeEventListener: (event, listener) => removeListener('SallaPush.Notifications.removeEventListener', hubs$2, event, listener),
};

const hubs$1 = { change: new SubscriptionHub() };
const PushSubscription = {
    getId: () => nullable$1(native.getPushSubscriptionId()),
    getToken: () => nullable$1(native.getPushSubscriptionToken()),
    getOptedIn: () => value(native.getPushSubscriptionOptedIn()),
    optIn: () => send('SallaPush.User.pushSubscription.optIn', () => native.optIn()),
    optOut: () => send('SallaPush.User.pushSubscription.optOut', () => native.optOut()),
    addEventListener: (event, listener) => addListener('SallaPush.User.pushSubscription.addEventListener', hubs$1, event, listener),
    removeEventListener: (event, listener) => removeListener('SallaPush.User.pushSubscription.removeEventListener', hubs$1, event, listener),
};

const hubs = {
    change: new EventHub({
        kind: 'user',
        name: "SallaPush.User 'change' listener",
        connect: (dispatch) => native.addListener('userChange', dispatch),
        map: userChange,
    }),
    loginFailure: new EventHub({
        kind: 'loginFailure',
        name: "SallaPush.User 'loginFailure' listener",
        connect: (dispatch) => native.addListener('loginFailure', dispatch),
        map: loginFailure,
    }),
};
// The entries of addTags and removeTags go to native unchecked: native skips and logs the ones that aren't strings.
const User = {
    pushSubscription: PushSubscription,
    getExternalId: () => nullable$1(native.getExternalId()),
    isLoggedIn: () => value(native.isLoggedIn()),
    addTag(key, value) {
        if (valid('SallaPush.User.addTag', {
            key: [key, string],
            value: [value, string],
        })) {
            send('SallaPush.User.addTag', () => native.addTag({ key, value }));
        }
    },
    addTags(tags) {
        if (valid('SallaPush.User.addTags', { tags: [tags, record] })) {
            send('SallaPush.User.addTags', () => native.addTags({ tags }));
        }
    },
    removeTag(key) {
        if (valid('SallaPush.User.removeTag', { key: [key, string] })) {
            send('SallaPush.User.removeTag', () => native.removeTag({ key }));
        }
    },
    removeTags(keys) {
        if (valid('SallaPush.User.removeTags', { keys: [keys, array] })) {
            send('SallaPush.User.removeTags', () => native.removeTags({ keys }));
        }
    },
    getTags: () => value(native.getTags()),
    setLanguage(language) {
        if (valid('SallaPush.User.setLanguage', {
            language: [language, nullable(string)],
        })) {
            send('SallaPush.User.setLanguage', () => native.setLanguage({ language }));
        }
    },
    addEventListener: (event, listener) => addListener('SallaPush.User.addEventListener', hubs, event, listener),
    removeEventListener: (event, listener) => removeListener('SallaPush.User.removeEventListener', hubs, event, listener),
};

/**
 * SallaPush for Capacitor. Every call is safe at any time, before or after initialization. On the web SallaPush isn't
 * available: requests reject with Capacitor's `UNIMPLEMENTED` error, and other calls print one console error each.
 */
const SallaPush = {
    initialize(appId, config) {
        if (!valid('SallaPush.initialize', {
            appId: [appId, string],
            config: [config, optional(record)],
        })) {
            return;
        }
        const spec = configSpec(config !== null && config !== void 0 ? config : {});
        if (spec) {
            send('SallaPush.initialize', () => native.initialize({ appId, config: spec }));
        }
    },
    isInitialized: () => value(native.isInitialized()),
    getAppId: () => nullable$1(native.getSallaPushAppId()),
    getSdkVersion: () => value(native.getSdkVersion()),
    setConsentRequired(required) {
        if (valid('SallaPush.setConsentRequired', { required: [required, boolean] })) {
            send('SallaPush.setConsentRequired', () => native.setConsentRequired({ required }));
        }
    },
    setConsentGiven(given) {
        if (valid('SallaPush.setConsentGiven', { given: [given, boolean] })) {
            send('SallaPush.setConsentGiven', () => native.setConsentGiven({ given }));
        }
    },
    login(externalId, identityToken) {
        if (valid('SallaPush.login', {
            externalId: [externalId, string],
            identityToken: [identityToken, string],
        })) {
            send('SallaPush.login', () => native.login({ externalId, identityToken }));
        }
    },
    logout: () => send('SallaPush.logout', () => native.logout()),
    User,
    Notifications,
    Debug,
    Migration,
};
/** The config as the native plugin takes it, with only the options that are set; null when an option is mistyped. */
function configSpec(config) {
    var _a;
    if (!valid('SallaPush.initialize', {
        'config.apiBaseUrl': [config.apiBaseUrl, optional(string)],
        'config.logLevel': [config.logLevel, optional(logLevel)],
        'config.appVersion': [config.appVersion, optional(string)],
        'config.clearTagsOnLogout': [config.clearTagsOnLogout, optional(boolean)],
        'config.requiresUserConsent': [
            config.requiresUserConsent,
            optional(boolean),
        ],
        'config.openLaunchUrls': [config.openLaunchUrls, optional(boolean)],
        'config.ios': [config.ios, optional(record)],
    })) {
        return null;
    }
    const ios = (_a = config.ios) !== null && _a !== void 0 ? _a : {};
    if (!valid('SallaPush.initialize', {
        'config.ios.appGroupIdentifier': [
            ios.appGroupIdentifier,
            optional(string),
        ],
        'config.ios.apnsEnvironment': [
            ios.apnsEnvironment,
            optional(apnsEnvironment),
        ],
        'config.ios.autoClearBadge': [ios.autoClearBadge, optional(boolean)],
        'config.ios.registerForRemoteNotificationsOnInit': [
            ios.registerForRemoteNotificationsOnInit,
            optional(boolean),
        ],
    })) {
        return null;
    }
    return setFields({
        apiBaseUrl: config.apiBaseUrl,
        logLevel: config.logLevel,
        appVersion: config.appVersion,
        clearTagsOnLogout: config.clearTagsOnLogout,
        requiresUserConsent: config.requiresUserConsent,
        openLaunchUrls: config.openLaunchUrls,
        iosAppGroupIdentifier: ios.appGroupIdentifier,
        iosApnsEnvironment: ios.apnsEnvironment,
        iosAutoClearBadge: ios.autoClearBadge,
        iosRegisterForRemoteNotificationsOnInit: ios.registerForRemoteNotificationsOnInit,
    });
}
/**
 * The fields that are set, so the bridges read every other option as native's default. A loop, not
 * Object.fromEntries, which the ES2017 build doesn't have.
 */
function setFields(spec) {
    const fields = {};
    for (const [key, field] of Object.entries(spec)) {
        if (field !== undefined && field !== null) {
            fields[key] = field;
        }
    }
    return fields;
}

exports.SallaPush = SallaPush;
exports.SallaPushAPNsEnvironment = SallaPushAPNsEnvironment;
exports.SallaPushIOSPermissionStatus = SallaPushIOSPermissionStatus;
exports.SallaPushLogLevel = SallaPushLogLevel;
exports.SallaPushLoginFailure = SallaPushLoginFailure;
exports.SallaPushPayloadSource = SallaPushPayloadSource;
//# sourceMappingURL=plugin.cjs.js.map
