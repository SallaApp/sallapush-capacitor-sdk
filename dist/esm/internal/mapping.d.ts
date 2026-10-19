import { type ClickEventSpec, type LogEntrySpec, type LoginFailureSpec, type NotificationSpec, type PermissionChangeSpec, type SubscriptionChangedSpec, type UserChangedSpec, type WillDisplayEventSpec } from './native';
import type { SallaPushClickEvent, SallaPushLogEntry, SallaPushLoginFailure, SallaPushNotification, SallaPushSubscriptionChangedState, SallaPushUserChangedState, SallaPushWillDisplayEvent } from '../definitions';
/**
 * A notification as native sent it, with typed getters that read the results of native's own accessors. `handle` names
 * the notification native holds for a will-display event, and `isPrevented` that event's decision; display() shows it
 * once it is prevented.
 */
export declare function notification(spec: NotificationSpec, handle?: string, isPrevented?: () => boolean): SallaPushNotification;
/** A will-display event: its notification holds the handle, and preventDefault() is the listeners' decision. */
export declare function willDisplayEvent(spec: WillDisplayEventSpec): SallaPushWillDisplayEvent;
export declare function clickEvent(spec: ClickEventSpec): SallaPushClickEvent;
export declare function permissionChange(spec: PermissionChangeSpec): boolean;
export declare function userChange(spec: UserChangedSpec): SallaPushUserChangedState;
export declare function loginFailure(spec: LoginFailureSpec): SallaPushLoginFailure;
export declare function subscriptionChange(spec: SubscriptionChangedSpec): SallaPushSubscriptionChangedState;
export declare function logEntry(spec: LogEntrySpec): SallaPushLogEntry;
