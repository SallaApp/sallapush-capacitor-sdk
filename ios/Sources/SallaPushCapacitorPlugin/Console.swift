import os

/// Where the wrapper's own lines go. Tests replace it with a recorder.
protocol ConsoleOutput {
    func error(_ message: String)
    func warn(_ message: String)
    func info(_ message: String)
}

/// The wrapper's own console lines, prefixed [SallaPush]: os.Logger, subsystem com.salla.push, category wrapper. Levels
/// map as native maps its own: warn to notice.
struct Console: ConsoleOutput {
    private let logger = Logger(subsystem: "com.salla.push", category: "wrapper")

    func error(_ message: String) {
        logger.error("[SallaPush] \(message, privacy: .public)")
    }

    func warn(_ message: String) {
        logger.notice("[SallaPush] \(message, privacy: .public)")
    }

    func info(_ message: String) {
        logger.info("[SallaPush] \(message, privacy: .public)")
    }
}

/// The lines already printed in this process: a platform-only call prints its line once per process. Main thread only.
final class OncePerProcess {
    static let shared = OncePerProcess()

    private var printed: Set<String> = []

    func info(_ message: String, to console: ConsoleOutput) {
        guard printed.insert(message).inserted else { return }
        console.info(message)
    }
}
