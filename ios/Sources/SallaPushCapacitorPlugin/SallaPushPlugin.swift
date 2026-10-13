import Capacitor
import Foundation

/// The SallaPush plugin that Capacitor loads; apps use the TypeScript API and SallaPushCapacitor.start().
@objc(SallaPushPlugin)
public final class SallaPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SallaPushPlugin"
    public let jsName = "SallaPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSdkVersion", returnType: CAPPluginReturnPromise)
    ]

    private let native: NativeSallaPush = LiveNativeSallaPush()

    override public func load() {
        SallaPushCapacitor.shared.pluginLoaded(pluginConfigIsEmpty: getConfig().isEmpty())
    }

    @objc func getSdkVersion(_ call: CAPPluginCall) {
        onMain { call.resolve(["value": self.native.sdkVersion]) }
    }
}

/// Runs work on the main thread: inline when already there, else on the main queue, which keeps the order of the calls
/// Capacitor's serial queue made.
func onMain(_ work: @escaping () -> Void) {
    guard Thread.isMainThread else {
        DispatchQueue.main.async(execute: work)
        return
    }
    work()
}
