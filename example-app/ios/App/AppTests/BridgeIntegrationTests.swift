import Capacitor
@testable import SallaPushCapacitorPlugin
import UIKit
import UserNotifications
import XCTest

/// The plugin in the running example: Capacitor's bridge made its notification router the delegate, then the plugin's
/// load() took the delegate back, chained to that router, and created the plugin's logic.
final class BridgeIntegrationTests: XCTestCase {
    func testSallaPushsDelegateIsTheCurrentOneAndChainedToTheBridgesRouter() throws {
        let bridge = try XCTUnwrap(bridgeOfTheKeyWindow(), "no CAPBridgeViewController with a bridge in the key window after 10 s")
        let delegate = SallaPushCapacitorNotificationCenterDelegate.shared

        XCTAssertTrue(UNUserNotificationCenter.current().delegate === delegate)
        XCTAssertTrue(delegate.router === bridge.notificationRouter)
        XCTAssertNil(delegate.previous)
    }

    func testCapacitorLoadedThePluginWithItsLogicOverTheLiveSDK() throws {
        let bridge = try XCTUnwrap(bridgeOfTheKeyWindow(), "no CAPBridgeViewController with a bridge in the key window after 10 s")
        let plugin = try XCTUnwrap(bridge.plugin(withName: "SallaPush") as? SallaPushPlugin)

        XCTAssertEqual(plugin.logic?.sdkVersion, SallaPush.sdkVersion)
    }

    /// The bridge of the key window's CAPBridgeViewController, once the scene connected: up to 10 s.
    private func bridgeOfTheKeyWindow() -> CAPBridgeProtocol? {
        let deadline = Date().addingTimeInterval(10)
        repeat {
            let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            if let bridge = (windows.first { $0.isKeyWindow }?.rootViewController as? CAPBridgeViewController)?.bridge {
                return bridge
            }
            RunLoop.main.run(until: Date().addingTimeInterval(0.1))
        } while Date() < deadline
        return nil
    }
}
