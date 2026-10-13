import Foundation
import SallaPush

/// The native SallaPush calls the wrapper makes. Tests replace it with a fake.
protocol NativeSallaPush: AnyObject {
    func initialize(_ appId: String, configuration: SallaPushConfiguration)
    var isInitialized: Bool { get }
    var appId: String? { get }
    var sdkVersion: String { get }
    func setConsentRequired(_ required: Bool)
    func setConsentGiven(_ given: Bool)
    func login(externalId: String, identityToken: String)
    func logout()
}

final class LiveNativeSallaPush: NativeSallaPush {
    func initialize(_ appId: String, configuration: SallaPushConfiguration) {
        SallaPush.initialize(appId, withLaunchOptions: nil, configuration: configuration)
    }

    var isInitialized: Bool { SallaPush.isInitialized }

    var appId: String? { SallaPush.appId }

    var sdkVersion: String { SallaPush.sdkVersion }

    func setConsentRequired(_ required: Bool) {
        SallaPush.setConsentRequired(required)
    }

    func setConsentGiven(_ given: Bool) {
        SallaPush.setConsentGiven(given)
    }

    func login(externalId: String, identityToken: String) {
        SallaPush.login(externalId: externalId, identityToken: identityToken)
    }

    func logout() {
        SallaPush.logout()
    }
}
