import { native, } from './native';
import { send } from './calls';
import { warnOnce } from './consoleOnce';
import { string, valid } from './validate';
/**
 * A notification as native sent it, with typed getters that read the results of native's own accessors. `handle` names
 * the notification native holds for a will-display event, and `isPrevented` that event's decision; display() shows it
 * once it is prevented.
 */
export function notification(spec, handle, isPrevented) {
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
export function willDisplayEvent(spec) {
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
export function clickEvent(spec) {
    var _a, _b;
    return Object.freeze({
        notification: notification(spec.notification),
        result: Object.freeze({
            actionId: (_a = spec.actionId) !== null && _a !== void 0 ? _a : null,
            url: (_b = spec.url) !== null && _b !== void 0 ? _b : null,
        }),
    });
}
export function permissionChange(spec) {
    return spec.permission;
}
export function userChange(spec) {
    return Object.freeze({
        previous: userState(spec.previous),
        current: userState(spec.current),
    });
}
export function loginFailure(spec) {
    return spec.failure;
}
export function subscriptionChange(spec) {
    return Object.freeze({
        previous: subscriptionState(spec.previous),
        current: subscriptionState(spec.current),
    });
}
export function logEntry(spec) {
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
//# sourceMappingURL=mapping.js.map