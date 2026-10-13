import Foundation
import SallaPush

/// The native SallaPush calls the wrapper makes. Tests replace it with a fake.
protocol NativeSallaPush: AnyObject {
    func initialize(_ appId: String, configuration: SallaPushConfiguration)
    var sdkVersion: String { get }
}

final class LiveNativeSallaPush: NativeSallaPush {
    func initialize(_ appId: String, configuration: SallaPushConfiguration) {
        SallaPush.initialize(appId, withLaunchOptions: nil, configuration: configuration)
    }

    var sdkVersion: String { SallaPush.sdkVersion }
}
