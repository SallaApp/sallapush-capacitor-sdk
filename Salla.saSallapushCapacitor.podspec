require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  # Capacitor's CLI names the pod after the npm package: @salla.sa/sallapush-capacitor becomes Salla.saSallapushCapacitor.
  s.name          = "Salla.saSallapushCapacitor"
  s.module_name   = "SallaPushCapacitorPlugin"
  s.version       = package["version"]
  s.summary       = package["description"]
  s.homepage      = package["homepage"]
  s.license       = { :type => "MIT", :file => "LICENSE" }
  s.author        = "Salla"

  s.platforms     = { :ios => "15.0" }
  s.swift_version = "5.0"
  s.source        = { :git => "https://github.com/SallaApp/sallapush-capacitor-sdk.git", :tag => "#{s.version}" }

  s.source_files  = "ios/Sources/SallaPushCapacitorPlugin/**/*.swift"

  # Capacitor 8 only, as the npm peer range; Capacitor's local pod reports @capacitor/ios's version (8.5.3).
  s.dependency "Capacitor", ">= 8.0.0", "< 9.0.0"
  # The SallaPush pods come from git, so the app's Podfile declares their source (README).
  s.dependency "SallaPush", "1.0.4"
end
