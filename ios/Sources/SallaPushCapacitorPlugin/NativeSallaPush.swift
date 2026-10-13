import Foundation
import SallaPush

/// The native SallaPush calls the wrapper makes. Tests replace it with a fake.
protocol NativeSallaPush: AnyObject {
    var sdkVersion: String { get }
}

final class LiveNativeSallaPush: NativeSallaPush {
    var sdkVersion: String { SallaPush.sdkVersion }
}
