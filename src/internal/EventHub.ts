import type { PluginListenerHandle } from '@capacitor/core';

import type {
  SallaPushEventSubscription,
  SallaPushSubscriptionChangedState,
} from '../definitions';
import { reportFailure } from './calls';
import { subscriptionChange } from './mapping';
import { native, type EventKind, type SubscriptionChangedSpec } from './native';
import { func, oneOf, valid } from './validate';

type Listener<Value> = (value: Value) => void;

/** Adds a hub's one Capacitor listener, such as (dispatch) => native.addListener('click', dispatch). */
type Connect<Payload> = (
  dispatch: (payload: Payload) => void
) => Promise<PluginListenerHandle>;

/** The listeners of one event; each hub takes its own listener type. */
export interface Hub {
  add(listener: never): SallaPushEventSubscription;
  remove(listener: never): void;
}

/** What a dropped addEventListener call returns. */
const inert: SallaPushEventSubscription = Object.freeze({ remove() {} });

/** A hub's native steps, run one after another in the order the app made its calls; a failing step is reported once. */
class Steps {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly name: string) {}

  run(step: () => Promise<unknown>): void {
    this.tail = this.tail.then(step).then(
      () => undefined,
      (error: unknown) => reportFailure(this.name, error)
    );
  }
}

/**
 * A hub's one Capacitor listener, added by the first step that needs it and kept for the page's lifetime: Capacitor
 * drops every listener when the WebView loads a page, together with the JavaScript that added it.
 */
class Connection<Payload> {
  private connected: Promise<PluginListenerHandle> | null = null;

  constructor(
    private readonly connect: Connect<Payload>,
    private readonly dispatch: (payload: Payload) => void
  ) {}

  // Added once; a failed add (no native plugin) is tried again by the next step that needs it.
  open(): Promise<PluginListenerHandle> {
    this.connected ??= this.connect(this.dispatch).catch((error: unknown) => {
      this.connected = null;
      throw error;
    });
    return this.connected;
  }
}

/**
 * The listeners of one event kind, behind one native registration. The first listener adds the Capacitor listener and
 * only then starts the native registration, so the events native delivers at once (the taps kept from a cold start)
 * reach it. The last removal stops the native registration; the Capacitor listener stays, so the listener bookkeeping
 * of Capacitor changes only once per event and page.
 */
export class EventHub<Payload, Value> implements Hub {
  private readonly listeners = new Set<Listener<Value>>();
  private readonly kind: EventKind;
  private readonly name: string;
  private readonly map: (payload: Payload) => Value;
  private readonly connection: Connection<Payload>;
  private readonly steps: Steps;

  constructor(options: {
    /** The native registration: click, permission, user or loginFailure. */
    kind: EventKind;
    /** The listeners as console lines name them. */
    name: string;
    connect: Connect<Payload>;
    map: (payload: Payload) => Value;
  }) {
    this.kind = options.kind;
    this.name = options.name;
    this.map = options.map;
    this.connection = new Connection(options.connect, (payload) =>
      this.dispatch(payload)
    );
    this.steps = new Steps(options.name);
  }

  add(listener: Listener<Value>): SallaPushEventSubscription {
    if (!this.listeners.has(listener)) {
      this.listeners.add(listener);
      if (this.listeners.size === 1) {
        this.steps.run(async () => {
          await this.connection.open();
          await native.startEvents({ kind: this.kind });
        });
      }
    }
    return { remove: () => this.remove(listener) };
  }

  // Events already on their way then reach no listener, and are dropped.
  remove(listener: Listener<Value>): void {
    if (!this.listeners.delete(listener) || this.listeners.size > 0) {
      return;
    }
    this.steps.run(() => native.stopEvents({ kind: this.kind }));
  }

  // A snapshot: a listener removed by another one during the dispatch still gets this event.
  private dispatch(payload: Payload): void {
    const value = this.map(payload);
    for (const listener of [...this.listeners]) {
      deliver(listener, value, this.name);
    }
  }
}

/**
 * The push-subscription listeners. Each one has its own native observer, so each gets native's own replay: the first
 * step adds the Capacitor listener, every listener then registers its id natively, and an event reaches only the
 * listener whose id it carries.
 */
export class SubscriptionHub implements Hub {
  private readonly ids = new Map<
    Listener<SallaPushSubscriptionChangedState>,
    number
  >();
  private readonly listeners = new Map<
    number,
    Listener<SallaPushSubscriptionChangedState>
  >();
  private readonly connection = new Connection<SubscriptionChangedSpec>(
    (dispatch) => native.addListener('pushSubscriptionChange', dispatch),
    (payload) => this.dispatch(payload)
  );
  private readonly steps = new Steps(
    "SallaPush.User.pushSubscription 'change' listener"
  );
  private nextId = 1;

  add(
    listener: Listener<SallaPushSubscriptionChangedState>
  ): SallaPushEventSubscription {
    if (!this.ids.has(listener)) {
      const id = this.nextId++;
      this.ids.set(listener, id);
      this.listeners.set(id, listener);
      this.steps.run(async () => {
        await this.connection.open();
        await native.addPushSubscriptionListener({ listenerId: id });
      });
    }
    return { remove: () => this.remove(listener) };
  }

  remove(listener: Listener<SallaPushSubscriptionChangedState>): void {
    const id = this.ids.get(listener);
    if (id === undefined) {
      return;
    }
    this.ids.delete(listener);
    this.listeners.delete(id);
    this.steps.run(() =>
      native.removePushSubscriptionListener({ listenerId: id })
    );
  }

  private dispatch(payload: SubscriptionChangedSpec): void {
    const listener = this.listeners.get(payload.listenerId);
    if (listener) {
      deliver(
        listener,
        subscriptionChange(payload),
        "SallaPush.User.pushSubscription 'change' listener"
      );
    }
  }
}

/**
 * Adds `listener` to the hub of `event`. A call with an unknown event or a listener that isn't a function is dropped
 * with one warning, and returns a subscription that does nothing.
 */
export function addListener(
  method: string,
  hubs: Readonly<Record<string, Hub>>,
  event: unknown,
  listener: unknown
): SallaPushEventSubscription {
  const hub = hubFor(method, hubs, event, listener);
  return hub ? hub.add(listener as never) : inert;
}

/** Removes `listener` from the hub of `event`; a call with an unknown event or a non-function listener is dropped. */
export function removeListener(
  method: string,
  hubs: Readonly<Record<string, Hub>>,
  event: unknown,
  listener: unknown
): void {
  hubFor(method, hubs, event, listener)?.remove(listener as never);
}

function hubFor(
  method: string,
  hubs: Readonly<Record<string, Hub>>,
  event: unknown,
  listener: unknown
): Hub | undefined {
  if (
    !valid(method, {
      event: [event, oneOf(Object.keys(hubs))],
      listener: [listener, func],
    })
  ) {
    return undefined;
  }
  return hubs[event as string];
}

/** Calls one listener; an exception it throws is reported, and doesn't reach the other listeners or native. */
function deliver<Value>(
  listener: Listener<Value>,
  value: Value,
  name: string
): void {
  try {
    listener(value);
  } catch (error) {
    console.error(`[SallaPush] A ${name} threw:`, error);
  }
}
