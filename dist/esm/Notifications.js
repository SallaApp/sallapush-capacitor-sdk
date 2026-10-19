import { EventHub, addListener, removeListener } from './internal/EventHub';
import { nullable as valueOrNull, send, value } from './internal/calls';
import { clickEvent, permissionChange, willDisplayEvent, } from './internal/mapping';
import { native } from './internal/native';
import { boolean, integer, nullable, optional, record, string, valid, } from './internal/validate';
const willDisplay = "SallaPush.Notifications 'foregroundWillDisplay' listener";
const hubs = {
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
export const Notifications = {
    getPermission: () => value(native.getPermission()),
    canRequestPermission: () => value(native.canRequestPermission()),
    getPermissionStatus: () => valueOrNull(native.getPermissionStatus()),
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
    addEventListener: (event, listener) => addListener('SallaPush.Notifications.addEventListener', hubs, event, listener),
    removeEventListener: (event, listener) => removeListener('SallaPush.Notifications.removeEventListener', hubs, event, listener),
};
//# sourceMappingURL=Notifications.js.map