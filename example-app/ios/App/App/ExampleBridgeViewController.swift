import Capacitor
import UIKit

/// The example's bridge view controller: it registers the example's own plugin before the page loads, as Capacitor
/// documents for an app's plugins.
class ExampleBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SmokeReporterPlugin())
    }
}
