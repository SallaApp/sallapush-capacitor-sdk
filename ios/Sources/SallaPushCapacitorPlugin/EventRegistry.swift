import Foundation

/// Emits events to JavaScript. SallaPushPlugin adopts it with Capacitor's notifyListeners.
protocol SallaPushEventEmitter: AnyObject {
    func emitOnClick(_ value: [String: Any])
    func emitOnPermissionChange(_ value: [String: Any])
    func emitOnUserChange(_ value: [String: Any])
    func emitOnLoginFailure(_ value: [String: Any])
    func emitOnPushSubscriptionChange(_ value: [String: Any])
}

/// The native listeners behind the JavaScript ones: one per event kind while JavaScript listens to it, and one push
/// subscription observer per JavaScript listener, so each gets native's own replay. Main thread only, where native
/// calls back too.
final class EventRegistry {
    /// The event kinds with one native registration each, as JavaScript names them.
    enum Kind: String {
        case click, permission, user, loginFailure
    }

    private let native: NativeSallaPush
    private weak var emitter: SallaPushEventEmitter?
    private var observations: [Kind: NativeObservation] = [:]
    private var subscriptionObservations: [Int: NativeObservation] = [:]

    init(native: NativeSallaPush, emitter: SallaPushEventEmitter) {
        self.native = native
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
        }
    }

    /// Emits while JavaScript listens to `kind`: native may still deliver an event it took before the stop.
    private func emit(_ kind: Kind, _ send: (SallaPushEventEmitter) -> Void) {
        guard observations[kind] != nil, let emitter else { return }
        send(emitter)
    }
}
