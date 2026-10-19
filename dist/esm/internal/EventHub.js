import { send } from './calls';
import { logEntry, subscriptionChange } from './mapping';
import { native, } from './native';
import { func, oneOf, valid } from './validate';
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
export class EventHub {
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
export class SubscriptionHub {
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
export class LogHandlerHub {
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
export function addListener(method, hubs, event, listener) {
    const hub = hubFor(method, hubs, event, listener);
    return hub ? hub.add(listener) : inert;
}
/** Removes `listener` from the hub of `event`; a call with an unknown event or a non-function listener is dropped. */
export function removeListener(method, hubs, event, listener) {
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
//# sourceMappingURL=EventHub.js.map