import SallaPush
@testable import SallaPushCapacitorPlugin
import XCTest

/// The options of a JavaScript initialize call, as InitOptions reads them from the call's config object.
final class InitOptionsTests: XCTestCase {
    // Each boolean alone, at the value that isn't native's default, so options swapped with each other can't pass.
    func testPassesEachBooleanOptionAloneAndLeavesTheOthersAtNativesDefaults() {
        let options: [(String, (SallaPushConfiguration) -> Bool)] = [
            ("clearTagsOnLogout", { $0.clearTagsOnLogout }),
            ("requiresUserConsent", { $0.requiresUserConsent }),
            ("openLaunchUrls", { $0.openLaunchURLs }),
            ("iosAutoClearBadge", { $0.autoClearBadge }),
            ("iosRegisterForRemoteNotificationsOnInit", { $0.registerForRemoteNotificationsOnInit })
        ]
        let defaults = SallaPushConfiguration()
        for (name, read) in options {
            let configuration = InitOptions([name: !read(defaults)]).configuration()
            for (other, readOther) in options {
                let expected = other == name ? !readOther(defaults) : readOther(defaults)
                XCTAssertEqual(readOther(configuration), expected, "\(name) alone: \(other)")
            }
        }
    }

    func testMapsEveryLogLevelAndAPNsEnvironmentByName() {
        let levels: [String: SallaPushLogLevel] = [
            "off": .off, "error": .error, "warn": .warn, "info": .info, "debug": .debug, "verbose": .verbose
        ]
        for (name, level) in levels {
            XCTAssertEqual(InitOptions(["logLevel": name]).configuration().logLevel, level, name)
        }
        let environments: [String: SallaPushAPNsEnvironment] = [
            "automatic": .automatic, "sandbox": .sandbox, "production": .production
        ]
        for (name, environment) in environments {
            XCTAssertEqual(InitOptions(["iosApnsEnvironment": name]).apnsEnvironment, environment, name)
        }
        let unknown = InitOptions(["logLevel": "Debug", "iosApnsEnvironment": "development"])
        XCTAssertNil(unknown.logLevel)
        XCTAssertNil(unknown.apnsEnvironment)
    }

    // As on Android, where native trims the URL, then logs config.invalid_base_url and uses production for text that
    // isn't one; nil would make native fall back to the Info.plist URL without a word.
    func testTrimsTheAPIURLAndPassesTextThatIsNoURLAsAnInvalidOne() {
        let padded = InitOptions(["apiBaseUrl": " https://staging.example.com/notifications/v1/sallapush \n"])
        XCTAssertEqual(padded.configuration().apiBaseURL, URL(string: "https://staging.example.com/notifications/v1/sallapush"))
        for text in ["", "  "] {
            let url = InitOptions(["apiBaseUrl": text]).configuration().apiBaseURL
            XCTAssertNotNil(url, "'\(text)'")
            XCTAssertNotEqual(url?.scheme, "https", "'\(text)'")
        }
    }
}
