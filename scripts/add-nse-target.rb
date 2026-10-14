#!/usr/bin/env ruby
# frozen_string_literal: true

# Adds the Notification Service Extension target SallaPushNotificationService to a Capacitor app's
# ios/App/App.xcodeproj, as the README's steps do in Xcode. The extension's NotificationService.swift and Info.plist
# come from <source folder> and go to ios/App/SallaPushNotificationService; the extension gets the App target's version
# and build, deployment target 15.0, and is embedded in App through "Embed Foundation Extensions". With --spm <version>
# it also links the SallaPushExtension product of the SallaPush iOS Swift package at exactly that version, under the
# URL of the plugin's Package.swift, so that Swift Package Manager resolves one package; a CocoaPods app links
# SallaPushExtension through its Podfile's extension block instead. scripts/verify.sh consumer runs it on fresh apps
# with the xcodeproj gem that CocoaPods ships; the example's extension target was made with it.
#
#   ruby scripts/add-nse-target.rb <app>/ios/App <source folder> [--spm <version>]

require 'fileutils'
require 'xcodeproj'

NAME = 'SallaPushNotificationService'
FILES = %w[NotificationService.swift Info.plist].freeze
PACKAGE_URL = 'https://github.com/SallaApp/sallapush-ios-sdk.git'
USAGE = 'usage: ruby scripts/add-nse-target.rb <app>/ios/App <folder with NotificationService.swift and Info.plist> ' \
        '[--spm <version>]'

ios, source, *options = ARGV
abort USAGE unless options.empty? || (options.length == 2 && options[0] == '--spm' && options[1] =~ /\A\d+\.\d+\.\d+\z/)
spm_version = options[1]
unless ios && source && File.directory?(File.join(ios, 'App.xcodeproj')) &&
       FILES.all? { |file| File.file?(File.join(source, file)) }
  abort USAGE
end

project = Xcodeproj::Project.open(File.join(ios, 'App.xcodeproj'))
app = project.targets.find { |target| target.name == 'App' }
abort 'add-nse-target.rb: the project has no App target' unless app
abort "add-nse-target.rb: the project already has a #{NAME} target" if project.targets.any? { |target| target.name == NAME }

FileUtils.mkdir_p(File.join(ios, NAME))
FILES.each do |file|
  from = File.join(source, file)
  to = File.join(ios, NAME, file)
  FileUtils.cp(from, to) unless File.exist?(to) && File.identical?(from, to)
end

# Made by hand: Project#new_target would also link a Foundation.framework of a fixed iOS SDK version.
extension = project.new(Xcodeproj::Project::Object::PBXNativeTarget)
project.targets << extension
extension.name = NAME
extension.product_name = NAME
extension.product_type = Xcodeproj::Constants::PRODUCT_TYPE_UTI[:app_extension]
extension.product_reference = project.products_group.new_product_ref_for_target(NAME, :app_extension)
configurations = project.new(Xcodeproj::Project::Object::XCConfigurationList)
configurations.default_configuration_is_visible = '0'
configurations.default_configuration_name = 'Release'
app.build_configurations.each do |app_configuration|
  app_settings = app_configuration.build_settings
  %w[PRODUCT_BUNDLE_IDENTIFIER MARKETING_VERSION CURRENT_PROJECT_VERSION].each do |key|
    abort "add-nse-target.rb: App has no #{key} in #{app_configuration.name}" unless app_settings[key]
  end
  configuration = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
  configuration.name = app_configuration.name
  configuration.build_settings = {
    'APPLICATION_EXTENSION_API_ONLY' => 'YES',
    'CODE_SIGN_STYLE' => 'Automatic',
    'CURRENT_PROJECT_VERSION' => app_settings['CURRENT_PROJECT_VERSION'],
    'INFOPLIST_FILE' => "#{NAME}/Info.plist",
    'IPHONEOS_DEPLOYMENT_TARGET' => '15.0',
    'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks'],
    'MARKETING_VERSION' => app_settings['MARKETING_VERSION'],
    'PRODUCT_BUNDLE_IDENTIFIER' => "#{app_settings['PRODUCT_BUNDLE_IDENTIFIER']}.#{NAME}",
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'SKIP_INSTALL' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'TARGETED_DEVICE_FAMILY' => '1,2'
  }
  configurations.build_configurations << configuration
end
extension.build_configuration_list = configurations
[Xcodeproj::Project::Object::PBXSourcesBuildPhase, Xcodeproj::Project::Object::PBXFrameworksBuildPhase,
 Xcodeproj::Project::Object::PBXResourcesBuildPhase].each { |phase| extension.build_phases << project.new(phase) }

group = project.main_group.new_group(nil, NAME)
app_group = project.main_group.children.find { |child| child.display_name == 'App' }
project.main_group.children.move(group, project.main_group.children.index(app_group) + 1) if app_group
extension.source_build_phase.add_file_reference(group.new_reference('NotificationService.swift'))
group.new_reference('Info.plist')

if spm_version
  requirement = { 'kind' => 'exactVersion', 'version' => spm_version }
  package = project.root_object.package_references.find do |reference|
    reference.respond_to?(:repositoryURL) && reference.repositoryURL == PACKAGE_URL
  end
  if package.nil?
    package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
    package.repositoryURL = PACKAGE_URL
    package.requirement = requirement
    project.root_object.package_references << package
  elsif package.requirement != requirement
    abort "add-nse-target.rb: the project already depends on #{PACKAGE_URL} with #{package.requirement}"
  end
  product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  product.package = package
  product.product_name = 'SallaPushExtension'
  extension.package_product_dependencies << product
  library = project.new(Xcodeproj::Project::Object::PBXBuildFile)
  library.product_ref = product
  extension.frameworks_build_phase.files << library
end

embed = app.copy_files_build_phases.find { |phase| phase.symbol_dst_subfolder_spec == :plug_ins } ||
        app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
embed.add_file_reference(extension.product_reference, true).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
app.add_dependency(extension)
project.save
puts "added #{NAME} to #{File.join(ios, 'App.xcodeproj')}" \
     "#{spm_version ? ", linking SallaPushExtension #{spm_version} through Swift Package Manager" : ''}"
