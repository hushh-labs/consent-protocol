// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.0.0"),
        .package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app"),
        .package(name: "CapacitorPreferences", path: "../../../node_modules/@capacitor/preferences"),
        // Google Sign-In SDK for native authentication
        .package(url: "https://github.com/google/GoogleSignIn-iOS", from: "8.0.0"),
        // Firebase iOS SDK for native credential exchange
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "11.0.0")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk")
            ]
        )
    ]
)
