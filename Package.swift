// swift-tools-version: 5.9
import PackageDescription

// Capacitor's CLI names the package and its product after the npm package: @salla.sa/sallapush-capacitor becomes
// Salla.saSallapushCapacitor. Apps import the module SallaPushCapacitorPlugin.
let package = Package(
    name: "Salla.saSallapushCapacitor",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "Salla.saSallapushCapacitor", targets: ["SallaPushCapacitorPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/SallaApp/sallapush-ios-sdk.git", exact: "1.0.4")
    ],
    targets: [
        .target(
            name: "SallaPushCapacitorPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "SallaPush", package: "sallapush-ios-sdk")
            ],
            path: "ios/Sources/SallaPushCapacitorPlugin"
        )
    ]
)
