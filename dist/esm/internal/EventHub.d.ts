import type { PluginListenerHandle } from '@capacitor/core';
import type { SallaPushEventSubscription, SallaPushLogEntry, SallaPushLogLevel, SallaPushSubscriptionChangedState } from '../definitions';
import { type EventKind } from './native';
type Listener<Value> = (value: Value) => void;
/** Adds a hub's one Capacitor listener, such as (dispatch) => native.addListener('click', dispatch). */
type Connect<Payload> = (dispatch: (payload: Payload) => void) => Promise<PluginListenerHandle>;
/** The listeners of one event; each hub takes its own listener type. */
export interface Hub {
    add(listener: never): SallaPushEventSubscription;
    remove(listener: never): void;
}
/**
 * The listeners of one event kind, behind one native registration. Every native call goes out at once, so it reaches
 * native in the order of the app's calls: Capacitor posts plugin calls in call order, and native runs them in that
 * order. The first listener adds the Capacitor listener, then starts the native registration, so the events native
 * delivers at once (the taps kept from a cold start) reach it. The last removal stops the native registration; the
 * Capacitor listener stays, so the listener bookkeeping of Capacitor changes only once per event and page.
 */
export declare class EventHub<Payload, Value> implements Hub {
    private readonly listeners;
    private readonly kind;
    private readonly name;
    private readonly map;
    private readonly decide?;
    private readonly connection;
    constructor(options: {
        /** The native registration: click, willDisplay, permission, user or loginFailure. */
        kind: EventKind;
        /** The listeners as console lines name them. */
        name: string;
        connect: Connect<Payload>;
        map: (payload: Payload) => Value;
        /**
         * Runs once the listeners got an event, for an event native waits on. The hub keeps its Capacitor listener after
         * the last removal, so an event already on its way still gets its decision.
         */
        decide?: (value: Value, payload: Payload) => void;
    });
    add(listener: Listener<Value>): SallaPushEventSubscription;
    remove(listener: Listener<Value>): void;
    private dispatch;
}
/**
 * The push-subscription listeners. Each one has its own native observer, so each gets native's own replay: the first
 * listener adds the Capacitor listener, every listener then registers its id natively, and an event reaches only the
 * listener whose id it carries.
 */
export declare class SubscriptionHub implements Hub {
    private readonly ids;
    private readonly listeners;
    private readonly connection;
    private nextId;
    add(listener: Listener<SallaPushSubscriptionChangedState>): SallaPushEventSubscription;
    remove(listener: Listener<SallaPushSubscriptionChangedState>): void;
    private dispatch;
}
/**
 * The app's one log handler. Its level reaches native before the native registration starts, so native registers at
 * it, and a later level only changes that registration. Removing the handler stops the registration; the Capacitor
 * listener stays for the page.
 */
export declare class LogHandlerHub {
    private handler;
    private readonly connection;
    set(level: SallaPushLogLevel, handler: Listener<SallaPushLogEntry> | null): void;
    private dispatch;
}
/**
 * Adds `listener` to the hub of `event`. A call with an unknown event or a listener that isn't a function is dropped
 * with one warning, and returns a subscription that does nothing.
 */
export declare function addListener(method: string, hubs: Readonly<Record<string, Hub>>, event: unknown, listener: unknown): SallaPushEventSubscription;
/** Removes `listener` from the hub of `event`; a call with an unknown event or a non-function listener is dropped. */
export declare function removeListener(method: string, hubs: Readonly<Record<string, Hub>>, event: unknown, listener: unknown): void;
export {};
