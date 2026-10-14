import Foundation
import SallaPush

/// Emits events to JavaScript. SallaPushPlugin adopts it with Capacitor's notifyListeners.
protocol SallaPushEventEmitter: AnyObject {
    func emitOnClick(_ value: [String: Any])
    func emitOnWillDisplay(_ value: [String: Any])
    func emitOnPermissionChange(_ value: [String: Any])
    func emitOnUserChange(_ value: [String: Any])
    func emitOnLoginFailure(_ value: [String: Any])
    func emitOnPushSubscriptionChange(_ value: [String: Any])
    func emitOnLog(_ value: [String: Any])
}

/// The native listeners behind the JavaScript ones: one per event kind while JavaScript listens to it, and one push
/// subscription observer per JavaScript listener, so each gets native's own replay. Main thread only, where native
/// calls back too.
final class EventRegistry {
    /// The event kinds with one native registration each, as JavaScript names them.
    enum Kind: String {
        case click, willDisplay, permission, user, loginFailure, log
    }

    private let native: NativeSallaPush
    private let displays: DisplayStore
    private weak var emitter: SallaPushEventEmitter?
    private var observations: [Kind: NativeObservation] = [:]
    private var subscriptionObservations: [Int: NativeObservation] = [:]
    private var logLevel: SallaPushLogLevel = .warn

    init(native: NativeSallaPush, displays: DisplayStore, emitter: SallaPushEventEmitter) {
        self.native = native
        self.displays = displays
        self.emitter = emitter
    }

    /// Registers the native listener of `kind`, once.
    func start(_ kind: Kind) {
        guard observations[kind] == nil else { return }
        observations[kind] = register(kind)
    }

    func stop(_ kind: Kind) {
        observations.removeValue(forKey: kind)?.cancel()
    }

    /// Adds the native observer of one JavaScript listener, once; its events carry `listenerId`.
    func addSubscriptionListener(_ listenerId: Int) {
        guard subscriptionObservations[listenerId] == nil else { return }
        subscriptionObservations[listenerId] = native.addSubscriptionObserver { [weak self] change in
            guard let self, self.subscriptionObservations[listenerId] != nil else { return }
            var body = change
            body["listenerId"] = listenerId
            self.emitter?.emitOnPushSubscriptionChange(body)
        }
    }

    func removeSubscriptionListener(_ listenerId: Int) {
        subscriptionObservations.removeValue(forKey: listenerId)?.cancel()
    }

    /// The level of JavaScript's log handler. While it is registered, native's handler is set again at the new level,
    /// which replaces it.
    func setLogLevel(_ level: SallaPushLogLevel) {
        guard level != logLevel else { return }
        logLevel = level
        guard observations[.log] != nil else { return }
        observations[.log] = register(.log)
    }

    /// Removes every native registration, as when the WebView loads a page.
    func stopAll() {
        let cancelled = Array(observations.values) + Array(subscriptionObservations.values)
        observations.removeAll()
        subscriptionObservations.removeAll()
        cancelled.forEach { $0.cancel() }
    }

    private func register(_ kind: Kind) -> NativeObservation {
        switch kind {
        case .click:
            return native.addClickListener { [weak self] event in
                self?.emit(kind) { $0.emitOnClick(event) }
            }
        case .willDisplay:
            return native.addForegroundLifecycleListener { [weak self] event in
                self?.hold(event)
            }
        case .permission:
            return native.addPermissionObserver { [weak self] permission in
                self?.emit(kind) { $0.emitOnPermissionChange(Mapping.permissionChange(permission)) }
            }
        case .user:
            return native.addUserObserver { [weak self] change in
                self?.emit(kind) { $0.emitOnUserChange(change) }
            }
        case .loginFailure:
            return native.addLoginFailureHandler { [weak self] failure in
                self?.emit(kind) { $0.emitOnLoginFailure(failure) }
            }
        case .log:
            // Native calls its log handler on its own queue.
            return native.setLogHandler(level: logLevel) { [weak self] entry in
                DispatchQueue.main.async {
                    self?.emit(kind) { $0.emitOnLog(entry) }
                }
            }
        }
    }

    /// Native decides when its listeners return, so the notification is prevented now and held for JavaScript, which
    /// shows it or keeps it hidden through its handle.
    private func hold(_ event: NativeWillDisplay) {
        emit(.willDisplay) { emitter in
            event.preventDefault()
            let handle = displays.put(event.display)
            emitter.emitOnWillDisplay(Mapping.willDisplay(event.notification, handle: handle))
        }
    }

    /// Emits while JavaScript listens to `kind`: native may still deliver an event it took before the stop.
    private func emit(_ kind: Kind, _ send: (SallaPushEventEmitter) -> Void) {
        guard observations[kind] != nil, let emitter else { return }
        send(emitter)
    }
}
