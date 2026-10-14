import Foundation

/// The foreground notifications held for JavaScript's decision, by handle. It keeps the closure that shows the very
/// object native matches display() by, for as long as native would show it: 600 s, and at most native's 20 records, the
/// oldest dropped first. Main thread only.
final class DisplayStore {
    static let window: TimeInterval = 600
    static let capacity = 20

    private struct Entry {
        let handle: String
        let display: () -> Void
        let heldAt: Date
    }

    private let console: ConsoleOutput
    private let now: () -> Date
    private var entries: [Entry] = []

    init(console: ConsoleOutput, now: @escaping () -> Date = Date.init) {
        self.console = console
        self.now = now
    }

    /// Holds `display`, which shows the notification, under a new random handle: its notification id can be nil.
    func put(_ display: @escaping () -> Void) -> String {
        dropExpired()
        let handle = UUID().uuidString
        entries.append(Entry(handle: handle, display: display, heldAt: now()))
        if entries.count > Self.capacity {
            entries.removeFirst()
        }
        return handle
    }

    /// Shows the notification held under `handle`, once; false, with a console line, when the handle is unknown or
    /// expired.
    @discardableResult
    func display(_ handle: String) -> Bool {
        dropExpired()
        guard let index = entries.firstIndex(where: { $0.handle == handle }) else {
            console.warn("SallaPushNotification.display() did nothing: a prevented notification is shown once, within "
                + "10 minutes of its foregroundWillDisplay event.")
            return false
        }
        entries.remove(at: index).display()
        return true
    }

    func clear() {
        entries.removeAll()
    }

    private func dropExpired() {
        let current = now()
        entries.removeAll { current.timeIntervalSince($0.heldAt) > Self.window }
    }
}
