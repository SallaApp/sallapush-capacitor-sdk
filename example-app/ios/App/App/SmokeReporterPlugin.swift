import Capacitor
import OSLog

/// The example's test hook for the smoke tests; never part of the library or of an app. JavaScript's
/// SmokeReporter.report({ line }) writes a self-test line to the unified log, where the smoke tests read it: release
/// builds don't forward the WebView's console.
@objc(SmokeReporterPlugin)
final class SmokeReporterPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "SmokeReporterPlugin"
    let jsName = "SmokeReporter"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "report", returnType: CAPPluginReturnNone)
    ]

    private let logger = Logger(subsystem: "sa.salla.sallapush.example", category: "smoke")

    @objc func report(_ call: CAPPluginCall) {
        let line = call.getString("line") ?? ""
        logger.info("\(line, privacy: .public)")
    }
}
