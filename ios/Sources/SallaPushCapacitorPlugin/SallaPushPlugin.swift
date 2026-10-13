import Capacitor
import Foundation

/// The SallaPush plugin that Capacitor loads; apps use the TypeScript API and SallaPushCapacitor.start(). Each method
/// reads its options on Capacitor's queue, then runs on the main thread, in call order, where SallaPush calls back.
@objc(SallaPushPlugin)
public final class SallaPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SallaPushPlugin"
    public let jsName = "SallaPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "isInitialized", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSallaPushAppId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSdkVersion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setConsentRequired", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "setConsentGiven", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnNone)
    ]

    /// The method logic. load() creates it over the live SDK; SallaPushPluginTests set it over FakeNativeSallaPush.
    /// Nil before, so a plugin that was never loaded answers every request with its neutral value and does nothing else.
    var logic: SallaPushBridge?

    override public func load() {
        SallaPushCapacitor.shared.pluginLoaded(pluginConfigIsEmpty: getConfig().isEmpty())
        logic = SallaPushBridge(native: LiveNativeSallaPush(), console: Console()) {
            SallaPushCapacitor.shared.earlyInit
        }
    }

    // MARK: - Initialization and consent

    @objc func initialize(_ call: CAPPluginCall) {
        guard let appId = call.getString("appId") else { return }
        let options: [String: Any] = call.getObject("config") ?? [:]
        onMain { self.logic?.initialize(appId: appId, options: options) }
    }

    @objc func isInitialized(_ call: CAPPluginCall) {
        onMain { call.resolve(value: self.logic?.isInitialized ?? false) }
    }

    @objc func getSallaPushAppId(_ call: CAPPluginCall) {
        onMain { call.resolve(value: self.logic?.appId) }
    }

    @objc func getSdkVersion(_ call: CAPPluginCall) {
        onMain { call.resolve(value: self.logic?.sdkVersion) }
    }

    @objc func setConsentRequired(_ call: CAPPluginCall) {
        guard let required = call.getBool("required") else { return }
        onMain { self.logic?.setConsentRequired(required) }
    }

    @objc func setConsentGiven(_ call: CAPPluginCall) {
        guard let given = call.getBool("given") else { return }
        onMain { self.logic?.setConsentGiven(given) }
    }

    // MARK: - Identity

    @objc func login(_ call: CAPPluginCall) {
        guard let externalId = call.getString("externalId"), let identityToken = call.getString("identityToken") else {
            return
        }
        onMain { self.logic?.login(externalId: externalId, identityToken: identityToken) }
    }

    @objc func logout(_ call: CAPPluginCall) {
        onMain { self.logic?.logout() }
    }
}

private extension CAPPluginCall {
    /// Resolves a request as JavaScript reads it: `{ value }`, with null for nil.
    func resolve(value: Any?) {
        resolve(["value": value ?? NSNull()])
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
