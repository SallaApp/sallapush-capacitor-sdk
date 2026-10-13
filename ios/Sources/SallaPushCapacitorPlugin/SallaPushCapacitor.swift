@_exported import SallaPush
import Foundation

/// Starts SallaPush natively at launch, so the tap that launched the app and pushes in processes without JavaScript
/// behave as in a native app. Call `SallaPushCapacitor.start()` as the first statement of
/// `application(_:didFinishLaunchingWithOptions:)`. `import SallaPushCapacitorPlugin` also gives Swift code the SallaPush
/// iOS API.
public final class SallaPushCapacitor: NSObject {
    static let shared = SallaPushCapacitor(
        native: LiveNativeSallaPush(),
        info: Bundle.main.infoDictionary ?? [:],
        console: Console()
    )

    private let native: NativeSallaPush
    private let info: [String: Any]
    private let console: ConsoleOutput
    private var started = false

    /// The static configuration SallaPush was started with in this process; nil when SallaPushAppId is not set.
    private(set) var earlyInit: StaticConfig?

    init(native: NativeSallaPush, info: [String: Any], console: ConsoleOutput) {
        self.native = native
        self.info = info
        self.console = console
    }

    /// Initializes SallaPush from the SallaPush… Info.plist keys when SallaPushAppId is set. It runs once per process,
    /// on the main thread; later calls do nothing.
    @objc public static func start() {
        onMain { shared.startOnce() }
    }

    func startOnce() {
        guard !started else { return }
        started = true
        let config = StaticConfig(info: info, console: console)
        if let appId = config.appId {
            native.initialize(appId, configuration: config.configuration())
            earlyInit = config
        }
    }

    /// From the plugin's load(), inside Capacitor's bridge initializer, on the main thread. An app that didn't call
    /// start() starts SallaPush here, too late for the tap that launched the app.
    func pluginLoaded() {
        startOnce()
    }
}
