import SallaPush
@testable import SallaPushCapacitorPlugin

final class RecordingConsole: ConsoleOutput {
    private(set) var errors: [String] = []
    private(set) var warnings: [String] = []
    private(set) var infos: [String] = []

    func error(_ message: String) {
        errors.append(message)
    }

    func warn(_ message: String) {
        warnings.append(message)
    }

    func info(_ message: String) {
        infos.append(message)
    }
}

/// Records the native calls, and answers the getters with the values a test sets.
final class FakeNativeSallaPush: NativeSallaPush {
    private(set) var initializedAppIds: [String] = []
    private(set) var configurations: [SallaPushConfiguration] = []
    var sdkVersion = "1.0.2"

    func initialize(_ appId: String, configuration: SallaPushConfiguration) {
        initializedAppIds.append(appId)
        configurations.append(configuration)
    }
}
