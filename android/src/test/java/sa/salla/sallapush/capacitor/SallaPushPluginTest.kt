package sa.salla.sallapush.capacitor

import android.content.Context
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.PluginResult
import com.salla.push.SallaPushConfig
import com.salla.push.SallaPushLogLevel
import com.salla.push.SallaPushLoginFailure
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowLog

@RunWith(RobolectricTestRunner::class)
class SallaPushPluginTest {
  private val context: Context = ApplicationProvider.getApplicationContext()
  private val native = FakeNativeSallaPush()
  private val once = OncePerProcess()

  @Before
  fun clearLog() {
    ShadowLog.clear()
  }

  // load()

  @Test
  fun loadReportsAPluginsSallaPushSectionOncePerProcessAndStartsNothing() {
    plugin(pluginConfigIsEmpty = false).load()
    plugin(pluginConfigIsEmpty = false).load()

    assertEquals(
      listOf(
        "[SallaPush] capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its settings from the " +
          "Info.plist keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and Android setup)."
      ),
      errors()
    )
    assertTrue(native.calls.isEmpty())
  }

  @Test
  fun loadReportsNothingWithoutAPluginsSallaPushSection() {
    plugin(pluginConfigIsEmpty = true).load()

    assertTrue(errors().isEmpty())
    assertTrue(native.calls.isEmpty())
  }

  // The test call itself: a PluginCall without Capacitor's message handler.

  @Test
  fun recordingCallRecordsEveryWayToSettleACallWithoutAMessageHandler() {
    val call = RecordingCall("test", json("key" to "value"))

    call.resolve()
    call.resolve(json("value" to true))
    call.successCallback(PluginResult(json("value" to 3)))
    call.errorCallback("failed")
    call.reject("rejected", "E_CODE", IllegalStateException("cause"), null)
    call.reject("plain")
    call.reject("coded", "E_OTHER")
    call.unimplemented()
    call.unavailable("not here")

    assertEquals(listOf("{}", "{\"value\":true}", "{\"value\":3}"), call.resolved.map { it.toString() })
    assertEquals(
      listOf(
        "failed" to null,
        "rejected" to "E_CODE",
        "plain" to null,
        "coded" to "E_OTHER",
        "not implemented" to "UNIMPLEMENTED",
        "not here" to "UNAVAILABLE",
      ),
      call.rejected
    )
    assertEquals("value", call.getString("key"))
    assertEquals("test", call.methodName)
  }

  // initialize

  @Test
  fun initializesWithTheAppIdTheApplicationContextAndEveryAndroidOption() {
    plugin().initialize(
      call(
        "initialize",
        "appId" to "st_42_android",
        "config" to json(
          "apiBaseUrl" to "https://push.example.com/notifications/v1/sallapush",
          "logLevel" to "debug",
          "appVersion" to "2.1.0",
          "clearTagsOnLogout" to false,
          "requiresUserConsent" to true,
          "openLaunchUrls" to true,
          "autoClearBadge" to false,
          "autoUpdateBadge" to false,
          "iosAppGroupIdentifier" to "group.sa.salla.example",
          "iosAutoClearBadge" to true,
        ),
      )
    )

    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
    assertSame(context, native.initContexts.single())
    val config = native.initConfigs.single()
    assertEquals("https://push.example.com/notifications/v1/sallapush", config.apiBaseUrl)
    assertEquals(SallaPushLogLevel.DEBUG, config.logLevel)
    assertEquals("2.1.0", config.appVersion)
    assertFalse(config.clearTagsOnLogout)
    assertTrue(config.requiresUserConsent)
    assertTrue(config.openLaunchUrls)
    assertFalse(config.autoClearBadge)
    assertFalse(config.autoUpdateBadge)
    assertTrue(errors().isEmpty())
  }

  // The deprecated ios.autoClearBadge is iOS only: Android keeps its own default.
  @Test
  fun ignoresTheDeprecatedIOSBadgeOption() {
    plugin().initialize(
      call("initialize", "appId" to "st_42_android", "config" to json("iosAutoClearBadge" to false))
    )

    assertTrue(native.initConfigs.single().autoClearBadge)
  }

  // Each boolean alone, at the value that isn't native's default, so options swapped with each other can't pass.
  @Test
  fun passesEachBooleanOptionAloneAndLeavesTheOthersAtNativesDefaults() {
    val options = mapOf<String, (SallaPushConfig) -> Boolean>(
      "clearTagsOnLogout" to { it.clearTagsOnLogout },
      "requiresUserConsent" to { it.requiresUserConsent },
      "openLaunchUrls" to { it.openLaunchUrls },
      "autoClearBadge" to { it.autoClearBadge },
      "autoUpdateBadge" to { it.autoUpdateBadge },
    )
    val defaults = SallaPushConfig.Builder().build()
    options.forEach { (name, read) ->
      val native = FakeNativeSallaPush()

      plugin(native = native).initialize(
        call("initialize", "appId" to "st_42_android", "config" to json(name to !read(defaults)))
      )

      val config = native.initConfigs.single()
      options.forEach { (other, readOther) ->
        val expected = if (other == name) !readOther(defaults) else readOther(defaults)
        assertEquals("$name alone: $other", expected, readOther(config))
      }
    }
  }

  @Test
  fun initializesWithNativeDefaultsForLeftOutOrNullOptions() {
    val plugin = plugin()

    plugin.initialize(call("initialize", "appId" to "st_42_android", "config" to json("appVersion" to null)))
    plugin.initialize(call("initialize", "appId" to "st_42_android"))

    assertEquals(2, native.initConfigs.size)
    native.initConfigs.forEach { config ->
      assertNull(config.apiBaseUrl)
      assertNull(config.logLevel)
      assertNull(config.appVersion)
      assertTrue(config.clearTagsOnLogout)
      assertFalse(config.requiresUserConsent)
      assertFalse(config.openLaunchUrls)
      assertTrue(config.autoClearBadge)
      assertTrue(config.autoUpdateBadge)
    }
  }

  @Test
  fun mapsEveryLogLevelByItsJavaScriptName() {
    val levels = mapOf(
      "off" to SallaPushLogLevel.OFF,
      "error" to SallaPushLogLevel.ERROR,
      "warn" to SallaPushLogLevel.WARN,
      "info" to SallaPushLogLevel.INFO,
      "debug" to SallaPushLogLevel.DEBUG,
      "verbose" to SallaPushLogLevel.VERBOSE,
    )
    val plugin = plugin()

    (levels.keys + "Debug").forEach {
      plugin.initialize(call("initialize", "appId" to "st_42_android", "config" to json("logLevel" to it)))
    }

    assertEquals(levels.values.toList() + listOf(null), native.initConfigs.map { it.logLevel })
  }

  // The TypeScript API validates every argument first, so only another caller could send these.
  @Test
  fun ignoresAMissingAppIdAndMistypedOptionsWithoutThrowing() {
    val plugin = plugin()

    plugin.initialize(call("initialize", "config" to json("logLevel" to "debug")))
    plugin.initialize(call("initialize", "appId" to 42))
    plugin.initialize(
      call(
        "initialize",
        "appId" to "st_42_android",
        "config" to json(
          "appVersion" to 2,
          "openLaunchUrls" to "yes",
          "requiresUserConsent" to 1,
          "autoClearBadge" to "false",
          "autoUpdateBadge" to 0,
        ),
      )
    )

    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
    val config = native.initConfigs.single()
    assertNull(config.appVersion)
    assertFalse(config.openLaunchUrls)
    assertFalse(config.requiresUserConsent)
    assertTrue(config.autoClearBadge)
    assertTrue(config.autoUpdateBadge)
  }

  // The early-init console errors

  @Test
  fun reportsTheOptionsASecondInitializeWithTheStaticAppIdIgnores() {
    val plugin = plugin(earlyInit = StaticConfig(appId = "st_42_android"))

    plugin.initialize(
      call(
        "initialize",
        "appId" to "st_42_android",
        "config" to json("logLevel" to "debug", "openLaunchUrls" to true, "iosAutoClearBadge" to false),
      )
    )

    assertEquals(
      listOf(
        "[SallaPush] initialize ignored logLevel, openLaunchUrls: SallaPush already started with this app id from " +
          "com.salla.push.APP_ID, so the call changes nothing. Set them with the meta-data com.salla.push.LOG_LEVEL, " +
          "com.salla.push.OPEN_LAUNCH_URLS instead."
      ),
      errors()
    )
    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
  }

  @Test
  fun namesTheMetaDataOfEveryIgnoredOption() {
    val plugin = plugin(earlyInit = StaticConfig(appId = "st_42_android"))

    plugin.initialize(
      call(
        "initialize",
        "appId" to "st_42_android",
        "config" to json(
          "logLevel" to "warn",
          "appVersion" to "2.1.0",
          "clearTagsOnLogout" to true,
          "requiresUserConsent" to true,
          "openLaunchUrls" to false,
          "autoClearBadge" to true,
          "autoUpdateBadge" to true,
        ),
      )
    )

    assertEquals(
      listOf(
        "[SallaPush] initialize ignored logLevel, appVersion, clearTagsOnLogout, requiresUserConsent, " +
          "openLaunchUrls, autoClearBadge, autoUpdateBadge: SallaPush already started with this app id from " +
          "com.salla.push.APP_ID, so the call changes nothing. Set them with the meta-data com.salla.push.LOG_LEVEL, " +
          "com.salla.push.APP_VERSION, com.salla.push.CLEAR_TAGS_ON_LOGOUT, com.salla.push.REQUIRES_USER_CONSENT, " +
          "com.salla.push.OPEN_LAUNCH_URLS, com.salla.push.AUTO_CLEAR_BADGE, com.salla.push.AUTO_UPDATE_BADGE " +
          "instead."
      ),
      errors()
    )
  }

  @Test
  fun reportsNothingForASecondInitializeWithoutAndroidOptions() {
    val plugin = plugin(earlyInit = StaticConfig(appId = "st_42_android"))

    plugin.initialize(call("initialize", "appId" to "st_42_android", "config" to json()))
    plugin.initialize(call("initialize", "appId" to "st_42_android", "config" to json("iosAutoClearBadge" to false)))

    assertTrue(errors().isEmpty())
    assertEquals(2, native.initConfigs.size)
  }

  @Test
  fun reportsNothingForAnotherAppId() {
    plugin(earlyInit = StaticConfig(appId = "st_42_android"))
      .initialize(call("initialize", "appId" to "st_7_android", "config" to json("logLevel" to "debug")))

    assertTrue(errors().isEmpty())
  }

  @Test
  fun reportsNothingWhenTheCallSetsTheApiHost() {
    plugin(earlyInit = StaticConfig(appId = "st_42_android")).initialize(
      call(
        "initialize",
        "appId" to "st_42_android",
        "config" to json("apiBaseUrl" to "http://10.0.2.2:9/notifications/v1/sallapush", "logLevel" to "debug"),
      )
    )

    assertTrue(errors().isEmpty())
  }

  @Test
  fun reportsNothingWithoutEarlyInit() {
    plugin().initialize(call("initialize", "appId" to "st_42_android", "config" to json("logLevel" to "debug")))

    assertTrue(errors().isEmpty())
  }

  @Test
  fun reportsConsentRequiredAfterEarlyInitWithoutTheStaticKey() {
    plugin(earlyInit = StaticConfig(appId = "st_42_android", requiresUserConsent = false))
      .setConsentRequired(call("setConsentRequired", "required" to true))

    assertEquals(
      listOf(
        "[SallaPush] setConsentRequired(true) came after SallaPush started from com.salla.push.APP_ID without " +
          "com.salla.push.REQUIRES_USER_CONSENT, so the device may already have registered and sent data. Set " +
          "com.salla.push.REQUIRES_USER_CONSENT to true in the manifest to require consent from the start."
      ),
      errors()
    )
    assertEquals(listOf("setConsentRequired(true)"), native.calls)
  }

  @Test
  fun reportsNothingWhenTheStaticKeyRequiresConsent() {
    plugin(earlyInit = StaticConfig(appId = "st_42_android", requiresUserConsent = true))
      .setConsentRequired(call("setConsentRequired", "required" to true))

    assertTrue(errors().isEmpty())
    assertEquals(listOf("setConsentRequired(true)"), native.calls)
  }

  @Test
  fun reportsNothingForConsentWithoutEarlyInitOrWhenNotRequired() {
    plugin().setConsentRequired(call("setConsentRequired", "required" to true))
    plugin(earlyInit = StaticConfig(appId = "st_42_android"))
      .setConsentRequired(call("setConsentRequired", "required" to false))

    assertTrue(errors().isEmpty())
    assertEquals(listOf("setConsentRequired(true)", "setConsentRequired(false)"), native.calls)
  }

  // Getters, consent and identity

  @Test
  fun resolvesTheNativeValuesAtCallTime() {
    val plugin = plugin()
    assertEquals(false, resolved { plugin.isInitialized(it) })
    assertNull(resolved { plugin.getSallaPushAppId(it) })

    native.isInitialized = true
    native.appId = "st_42_android"

    assertEquals(true, resolved { plugin.isInitialized(it) })
    assertEquals("st_42_android", resolved { plugin.getSallaPushAppId(it) })
    assertEquals("1.0.2", resolved { plugin.getSdkVersion(it) })
  }

  @Test
  fun resolvesNullAsJsonNullSoJavaScriptReadsNull() {
    val call = RecordingCall("getSallaPushAppId")

    plugin().getSallaPushAppId(call)

    assertEquals("{\"value\":null}", call.resolved.single().toString())
  }

  @Test
  fun rejectsWithTheInternalCodeWhenTheBridgeFails() {
    val failing = object : NativeSallaPush by native {
      override val isInitialized: Boolean
        get() = throw IllegalStateException("bridge failure")
    }
    val call = RecordingCall("isInitialized")

    plugin(native = failing).isInitialized(call)

    assertTrue(call.resolved.isEmpty())
    assertEquals(
      listOf("SallaPush failed: java.lang.IllegalStateException: bridge failure" to "E_SALLAPUSH_INTERNAL"),
      call.rejected
    )
  }

  @Test
  fun passesConsentAndIdentityCallsUnchangedAndNeverSettlesThem() {
    val plugin = plugin()
    val calls = listOf(
      call("setConsentGiven", "given" to true),
      call("setConsentGiven", "given" to false),
      call("login", "externalId" to " customer-7 ", "identityToken" to " token "),
      call("logout"),
    )

    plugin.setConsentGiven(calls[0])
    plugin.setConsentGiven(calls[1])
    plugin.login(calls[2])
    plugin.logout(calls[3])

    assertEquals(
      listOf("setConsentGiven(true)", "setConsentGiven(false)", "login( customer-7 ,  token )", "logout()"),
      native.calls
    )
    assertTrue(calls.all { it.resolved.isEmpty() && it.rejected.isEmpty() })
  }

  // User and push subscription

  @Test
  fun resolvesTheUserAndThePushSubscriptionAtCallTime() {
    val plugin = plugin()
    assertNull(resolved { plugin.getExternalId(it) })
    assertEquals(false, resolved { plugin.isLoggedIn(it) })
    assertEquals("{}", resolved { plugin.getTags(it) }.toString())
    assertNull(resolved { plugin.getPushSubscriptionId(it) })
    assertNull(resolved { plugin.getPushSubscriptionToken(it) })
    assertEquals(false, resolved { plugin.getPushSubscriptionOptedIn(it) })

    native.externalId = "customer-7"
    native.isLoggedIn = true
    native.tags = mapOf("level" to "gold", "city" to "riyadh")
    native.pushSubscriptionId = "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40"
    native.pushSubscriptionToken = "fcm-token"
    native.pushSubscriptionOptedIn = true

    assertEquals("customer-7", resolved { plugin.getExternalId(it) })
    assertEquals(true, resolved { plugin.isLoggedIn(it) })
    val tags = resolved { plugin.getTags(it) } as JSONObject
    assertEquals(mapOf("level" to "gold", "city" to "riyadh"), Conversions.entries(tags))
    assertEquals("3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", resolved { plugin.getPushSubscriptionId(it) })
    assertEquals("fcm-token", resolved { plugin.getPushSubscriptionToken(it) })
    assertEquals(true, resolved { plugin.getPushSubscriptionOptedIn(it) })
  }

  @Test
  fun passesTagEntriesToNativeUncheckedForItsPerEntryRule() {
    val plugin = plugin()

    plugin.addTags(call("addTags", "tags" to json("level" to "gold", "visits" to 3, "vip" to true, "note" to null)))
    plugin.removeTags(call("removeTags", "keys" to JSArray().put("level").put(3).put(JSONObject.NULL)))

    assertEquals(listOf(mapOf("level" to "gold", "visits" to 3, "vip" to true, "note" to null)), native.addedTags)
    assertEquals(listOf(listOf("level", 3, null)), native.removedTags)
  }

  @Test
  fun passesTagLanguageAndSubscriptionCallsUnchangedWithJsonNullAsTheDeviceLanguage() {
    val plugin = plugin()

    plugin.addTag(call("addTag", "key" to " Level ", "value" to ""))
    plugin.removeTag(call("removeTag", "key" to " City "))
    plugin.setLanguage(call("setLanguage", "language" to "ar"))
    plugin.setLanguage(call("setLanguage", "language" to null))
    plugin.optIn(call("optIn"))
    plugin.optOut(call("optOut"))

    assertEquals(
      listOf("addTag( Level , )", "removeTag( City )", "setLanguage(ar)", "setLanguage(null)", "optIn()", "optOut()"),
      native.calls
    )
  }

  // The TypeScript API validates every argument first, so only another caller could send these.
  @Test
  fun doesNothingForAMissingOrMistypedUserOption() {
    val plugin = plugin()

    plugin.addTag(call("addTag", "key" to "level"))
    plugin.addTag(call("addTag", "key" to "vip", "value" to true))
    plugin.addTags(call("addTags", "tags" to "level=gold"))
    plugin.removeTag(call("removeTag"))
    plugin.removeTags(call("removeTags", "keys" to "level"))
    plugin.setLanguage(call("setLanguage"))
    plugin.setLanguage(call("setLanguage", "language" to 1))

    assertTrue(native.calls.isEmpty())
  }

  // Permission and notifications

  @Test
  fun resolvesThePermissionAtCallTime() {
    val plugin = plugin()
    assertEquals(false, resolved { plugin.getPermission(it) })
    assertEquals(false, resolved { plugin.canRequestPermission(it) })

    native.permission = true
    native.canRequest = true

    assertEquals(true, resolved { plugin.getPermission(it) })
    assertEquals(true, resolved { plugin.canRequestPermission(it) })
  }

  @Test
  fun requestsThePermissionAndResolvesNativesAnswer() {
    native.permissionAnswer = true
    val plugin = plugin()

    assertEquals(true, resolved(json("fallbackToSettings" to true)) { plugin.requestPermission(it) })
    assertEquals(true, resolved(json("fallbackToSettings" to false)) { plugin.requestPermission(it) })
    assertEquals(true, resolved { plugin.requestPermission(it) })
    assertEquals(listOf("requestPermission(true)", "requestPermission(false)", "requestPermission(false)"), native.calls)
  }

  @Test
  fun iosOnlyCallsResolveNeutralValuesAndSayItOncePerProcess() {
    val plugin = plugin()

    repeat(2) {
      assertNull(resolved { plugin.getPermissionStatus(it) })
      assertEquals(false, resolved { plugin.registerForProvisionalAuthorization(it) })
      plugin.registerForRemoteNotifications(call("registerForRemoteNotifications"))
      plugin.forwardApnsToken(call("forwardApnsToken", "apnsToken" to "0A1BFF7C"))
    }
    plugin(native = native).registerForRemoteNotifications(call("registerForRemoteNotifications"))

    assertTrue(native.calls.isEmpty())
    assertEquals(
      listOf(
        "[SallaPush] Notifications.getPermissionStatus is iOS only and resolves null on Android.",
        "[SallaPush] Notifications.registerForProvisionalAuthorization is iOS only and resolves false on Android.",
        "[SallaPush] Notifications.registerForRemoteNotifications is iOS only and does nothing on Android.",
        "[SallaPush] Notifications.forwardApnsToken is iOS only and does nothing on Android.",
      ),
      infos()
    )
  }

  @Test
  fun passesRefreshClearAllAndRemoveNotificationAndNeverSettlesThem() {
    val plugin = plugin()
    val calls = listOf(
      call("refreshPermission"),
      call("clearAll"),
      call("removeNotification", "androidNotificationId" to 42),
      call("removeNotification", "androidNotificationId" to Int.MIN_VALUE),
    )

    plugin.refreshPermission(calls[0])
    plugin.clearAll(calls[1])
    plugin.removeNotification(calls[2])
    plugin.removeNotification(calls[3])

    assertEquals(
      listOf(
        "refreshPermission()",
        "clearAllNotifications()",
        "removeNotification(42)",
        "removeNotification(-2147483648)",
      ),
      native.calls
    )
    assertTrue(calls.all { it.resolved.isEmpty() && it.rejected.isEmpty() })
  }

  @Test
  fun checksAPayloadAsAnFcmDataMapAndResolvesNativesAnswer() {
    native.recognizesMessages = true
    val custom = json("i" to "os-id", "a" to json("push_ref" to "msg_1a2b"))

    val payload = json("alert" to "Hi", "custom" to custom, "badge" to 2, "none" to null)

    val recognized = resolved(json("payload" to payload)) { plugin().isSallaPushNotification(it) }

    assertEquals(true, recognized)
    val data = native.checkedMessages.single()
    assertEquals(setOf("alert", "custom", "badge"), data.keys)
    assertEquals("Hi", data["alert"])
    assertEquals("2", data["badge"])
    assertEquals("msg_1a2b", JSONObject(data.getValue("custom")).getJSONObject("a").getString("push_ref"))
  }

  @Test
  fun tracksOpenedWithTheDataAsAJsonObject() {
    native.tracksOpened = true
    val plugin = plugin()

    val data = json("additionalData" to json("push_ref" to "msg_1a2b", "screen" to "offers"))
    assertEquals(true, resolved(data) { plugin.trackOpened(it) })
    assertEquals(true, resolved(json("additionalData" to null)) { plugin.trackOpened(it) })

    assertEquals("msg_1a2b", native.openedData.first()?.getString("push_ref"))
    assertEquals("offers", native.openedData.first()?.getString("screen"))
    assertNull(native.openedData.last())
  }

  // The TypeScript API validates every argument first, so only another caller could send these.
  @Test
  fun usesTheDefaultsOrDoesNothingForAMissingOrMistypedNotificationOption() {
    val plugin = plugin()

    assertEquals(false, resolved(json("fallbackToSettings" to "yes")) { plugin.requestPermission(it) })
    assertEquals(false, resolved(json("payload" to "sp_v")) { plugin.isSallaPushNotification(it) })
    plugin.removeNotification(call("removeNotification", "androidNotificationId" to "42"))
    plugin.removeNotification(call("removeNotification", "androidNotificationId" to 1.5))
    plugin.removeNotification(call("removeNotification"))

    assertEquals(listOf("requestPermission(false)"), native.calls)
    assertEquals(listOf(emptyMap<String, String>()), native.checkedMessages)
  }

  // Debug and migration

  @Test
  fun readsAndSetsEveryLogLevelByItsJavaScriptName() {
    val levels = mapOf(
      "off" to SallaPushLogLevel.OFF,
      "error" to SallaPushLogLevel.ERROR,
      "warn" to SallaPushLogLevel.WARN,
      "info" to SallaPushLogLevel.INFO,
      "debug" to SallaPushLogLevel.DEBUG,
      "verbose" to SallaPushLogLevel.VERBOSE,
    )
    val plugin = plugin()

    levels.forEach { (name, level) ->
      native.logLevel = level
      assertEquals(name, resolved { plugin.getLogLevel(it) })
    }
    levels.entries.reversed().forEach { (name, level) ->
      val call = call("setLogLevel", "level" to name)
      plugin.setLogLevel(call)
      assertEquals(level, native.logLevel)
      assertTrue(call.resolved.isEmpty() && call.rejected.isEmpty())
    }
  }

  @Test
  fun ignoresALogLevelNameThatIsNotALevel() {
    native.logLevel = SallaPushLogLevel.ERROR
    val plugin = plugin()

    plugin.setLogLevel(call("setLogLevel", "level" to "Debug"))
    plugin.setLogLevel(call("setLogLevel", "level" to "trace"))
    plugin.setLogLevel(call("setLogLevel", "level" to 3))
    plugin.setLogLevel(call("setLogLevel"))

    assertEquals(SallaPushLogLevel.ERROR, native.logLevel)
  }

  @Test
  fun passesTheCompatibilitySetting() {
    val plugin = plugin()

    plugin.setDisplayOneSignalCompatPayloads(call("setDisplayOneSignalCompatPayloads", "display" to false))
    plugin.setDisplayOneSignalCompatPayloads(call("setDisplayOneSignalCompatPayloads", "display" to true))
    plugin.setDisplayOneSignalCompatPayloads(call("setDisplayOneSignalCompatPayloads", "display" to "true"))

    assertEquals(
      listOf("setDisplayOneSignalCompatPayloads(false)", "setDisplayOneSignalCompatPayloads(true)"),
      native.calls
    )
  }

  // The TypeScript API validates every argument first, so only another caller could send these.
  @Test
  fun doesNothingForAMissingOrMistypedOption() {
    val plugin = plugin()

    plugin.setConsentRequired(call("setConsentRequired", "required" to "true"))
    plugin.setConsentGiven(call("setConsentGiven"))
    plugin.login(call("login", "externalId" to "customer-7"))
    plugin.login(call("login", "externalId" to null, "identityToken" to "token"))

    assertTrue(native.calls.isEmpty())
  }

  // Events, and the threads they and the registrations run on

  @Test
  fun eventsReachTheListenersJavaScriptAddedAsResolutionsOfTheirCalls() {
    val plugin = plugin()
    val click = listener(plugin, "click")
    val permission = listener(plugin, "permissionChange")
    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.startEvents(call("startEvents", "kind" to "permission"))
    val event = NativeValues.click(testNotification(), null, "https://example.com/products/42")

    native.clickListeners.single().onClick(event)
    native.permissionObservers.single().onNotificationPermissionChange(true)

    assertEquals(listOf(Conversions.toJSObject(Mapping.click(event)).toString()), click.resolved.map { it.toString() })
    assertEquals("https://example.com/products/42", click.resolved.single().getString("url"))
    assertEquals(listOf("""{"permission":true}"""), permission.resolved.map { it.toString() })
    assertTrue(click.rejected.isEmpty())
  }

  @Test
  fun emitsUserLoginFailureAndSubscriptionEventsUnderTheirCapacitorNames() {
    val plugin = plugin()
    val user = listener(plugin, "userChange")
    val loginFailure = listener(plugin, "loginFailure")
    val subscription = listener(plugin, "pushSubscriptionChange")
    plugin.startEvents(call("startEvents", "kind" to "user"))
    plugin.startEvents(call("startEvents", "kind" to "loginFailure"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 1))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 2))
    val (userObserver, loginFailureObserver) = native.userObservers
    val state = NativeValues.subscription("3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", null, true)

    userObserver.onUserStateChange(
      NativeValues.userChange(NativeValues.user(null, false), NativeValues.user("customer-7", true))
    )
    loginFailureObserver.onLoginFailure(SallaPushLoginFailure.TOKEN_REJECTED)
    native.subscriptionObservers[1].onPushSubscriptionChange(NativeValues.subscriptionChange(state, state))

    assertEquals(
      listOf("""{"previous":{"isLoggedIn":false},"current":{"externalId":"customer-7","isLoggedIn":true}}"""),
      user.resolved.map { it.toString() }
    )
    assertEquals(listOf("""{"failure":"tokenRejected"}"""), loginFailure.resolved.map { it.toString() })
    assertEquals(
      listOf(
        """{"listenerId":2,"previous":{"id":"3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40","optedIn":true},""" +
          """"current":{"id":"3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40","optedIn":true}}"""
      ),
      subscription.resolved.map { it.toString() }
    )
  }

  @Test
  fun registersOnTheMainThreadAndEmitsOnThePluginThreadInCallOrder() {
    val main = mutableListOf<() -> Unit>()
    val pluginThread = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnMain = { main += it }, runOnPluginThread = { pluginThread += it })
    val click = listener(plugin, "click")

    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 3))
    assertTrue(native.calls.isEmpty())
    main.drain()
    val clickListener = native.clickListeners.single()
    val observer = native.subscriptionObservers.single()
    clickListener.onClick(NativeValues.click(testNotification(), null, null))
    assertTrue(click.resolved.isEmpty())
    pluginThread.drain()
    assertEquals(1, click.resolved.size)
    plugin.stopEvents(call("stopEvents", "kind" to "click"))
    plugin.removePushSubscriptionListener(call("removePushSubscriptionListener", "listenerId" to 3))
    main.drain()

    assertEquals(
      listOf("addClickListener", "addSubscriptionObserver", "removeClickListener", "removeSubscriptionObserver"),
      native.calls
    )
    assertEquals(listOf<Any>(clickListener, observer), native.removed)
  }

  @Test
  fun holdsAForegroundNotificationForJavaScriptAndShowsItOnceThroughItsHandle() {
    val plugin = plugin()
    val willDisplay = listener(plugin, "willDisplay")
    plugin.startEvents(call("startEvents", "kind" to "willDisplay"))
    val notification = testNotification()
    val event = NativeValues.willDisplay(notification)

    native.foregroundListeners.single().onWillDisplay(event)
    val held = willDisplay.resolved.single()
    plugin.displayNotification(call("displayNotification", "handle" to held.getString("handle")))
    plugin.displayNotification(call("displayNotification", "handle" to held.getString("handle")))

    assertTrue(event.isPrevented)
    assertEquals(
      Conversions.toJSObject(Mapping.notification(notification)).toString(),
      held.getJSONObject("notification").toString()
    )
    assertSame(notification, native.displayed.single())
    assertEquals(1, ShadowLog.getLogsForTag("SallaPush").count { it.type == Log.WARN })
  }

  @Test
  fun postsDisplayNotificationToTheMainThreadAndItsStore() {
    val main = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnMain = { main += it })

    plugin.displayNotification(call("displayNotification", "handle" to "8d1e3d0a-1a1b-4c63-9d38-4c2b2b7e5f10"))
    assertTrue(ShadowLog.getLogsForTag("SallaPush").isEmpty())
    main.drain()

    assertTrue(native.displayed.isEmpty())
    assertEquals(1, ShadowLog.getLogsForTag("SallaPush").count { it.type == Log.WARN })
  }

  @Test
  fun postsTheLogHandlerLevelToTheMainThreadAndIgnoresAnUnknownName() {
    val main = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnMain = { main += it })

    plugin.startEvents(call("startEvents", "kind" to "log"))
    plugin.setLogHandlerLevel(call("setLogHandlerLevel", "level" to "verbose"))
    plugin.setLogHandlerLevel(call("setLogHandlerLevel", "level" to "trace"))
    plugin.setLogHandlerLevel(call("setLogHandlerLevel", "level" to 3))
    plugin.setLogHandlerLevel(call("setLogHandlerLevel"))
    assertTrue(native.calls.isEmpty())
    main.drain()

    assertEquals(listOf("addLogListener(WARN)", "addLogListener(VERBOSE)"), native.calls)
  }

  // Native logs on its own thread; the registry hops to main, and the plugin emits on its own thread.
  @Test
  fun emitsLogEntriesThroughTheMainThreadOnThePluginThread() {
    val main = mutableListOf<() -> Unit>()
    val pluginThread = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnMain = { main += it }, runOnPluginThread = { pluginThread += it })
    val log = listener(plugin, "log")
    plugin.startEvents(call("startEvents", "kind" to "log"))
    main.drain()
    val event = NativeValues.logEvent(
      SallaPushLogLevel.WARN,
      "registration",
      "register.retry",
      "Registration failed (HTTP 503); retrying in 30 s.",
      mapOf("http_status" to "503"),
      1_800_000_000_123L,
    )

    native.logListeners.keys.single().onLogEvent(event)
    assertTrue(pluginThread.isEmpty())
    main.drain()
    assertTrue(log.resolved.isEmpty())
    pluginThread.drain()

    val entry = log.resolved.single()
    assertEquals(Conversions.toJSObject(Mapping.logEntry(event)).toString(), entry.toString())
    assertEquals("warn", entry.getString("level"))
    assertEquals("503", entry.getJSONObject("metadata").getString("http_status"))
    assertEquals(1_800_000_000_123L, entry.getLong("timestamp"))
  }

  // The TypeScript API sends only known kinds, integer ids and string handles, so only another caller could send these.
  @Test
  fun ignoresAnUnknownKindAndAMissingOrMistypedEventOption() {
    val plugin = plugin()

    plugin.startEvents(call("startEvents", "kind" to "opened"))
    plugin.startEvents(call("startEvents", "kind" to 1))
    plugin.startEvents(call("startEvents"))
    plugin.stopEvents(call("stopEvents"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to "3"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 1.5))
    plugin.removePushSubscriptionListener(call("removePushSubscriptionListener"))
    plugin.displayNotification(call("displayNotification"))
    plugin.displayNotification(call("displayNotification", "handle" to 7))

    assertTrue(native.calls.isEmpty())
    assertTrue(ShadowLog.getLogsForTag("SallaPush").isEmpty())
  }

  // Resets and destruction

  // Capacitor's reset when the WebView loads a page: on main, before the new page adds its listeners.
  @Test
  fun aPageLoadStopsEveryRegistrationAndDropsTheOldPagesListenersWhileThePluginKeepsWorking() {
    val pluginThread = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnPluginThread = { pluginThread += it })
    val oldPage = listener(plugin, "click")
    val handle = holdAForegroundNotification(plugin, pluginThread)
    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.startEvents(call("startEvents", "kind" to "user"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 1))

    plugin.removeAllListeners()

    assertTrue(native.clickListeners.isEmpty())
    assertTrue(native.foregroundListeners.isEmpty())
    assertTrue(native.userObservers.isEmpty())
    assertTrue(native.subscriptionObservers.isEmpty())
    plugin.displayNotification(call("displayNotification", "handle" to handle))
    assertTrue(native.displayed.isEmpty())
    pluginThread.drain()
    val newPage = listener(plugin, "click")
    plugin.startEvents(call("startEvents", "kind" to "click"))
    native.clickListeners.single().onClick(NativeValues.click(testNotification(), null, null))
    pluginThread.drain()
    assertTrue(oldPage.resolved.isEmpty())
    assertEquals(1, newPage.resolved.size)
  }

  @Test
  fun javaScriptsRemoveAllListenersStopsEveryRegistrationAndResolves() {
    val plugin = plugin()
    val click = listener(plugin, "click")
    val handle = holdAForegroundNotification(plugin)
    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 1))
    val removeAll = call("removeAllListeners")

    plugin.removeAllListeners(removeAll)

    assertTrue(native.clickListeners.isEmpty())
    assertTrue(native.foregroundListeners.isEmpty())
    assertTrue(native.subscriptionObservers.isEmpty())
    plugin.displayNotification(call("displayNotification", "handle" to handle))
    assertTrue(native.displayed.isEmpty())
    assertEquals(listOf("{}"), removeAll.resolved.map { it.toString() })
    plugin.startEvents(call("startEvents", "kind" to "click"))
    native.clickListeners.single().onClick(NativeValues.click(testNotification(), null, null))
    assertTrue(click.resolved.isEmpty())
  }

  // PluginHandle finds plugin methods by their annotation, which an override doesn't inherit.
  @Test
  fun javaScriptsRemoveAllListenersIsAnAnnotatedPromiseMethod() {
    val method = SallaPushPlugin::class.java.getMethod("removeAllListeners", PluginCall::class.java)

    assertEquals(PluginMethod.RETURN_PROMISE, method.getAnnotation(PluginMethod::class.java)?.returnType)
  }

  // Capacitor's quitSafely() still runs the calls it had queued after onDestroy, and native may have queued callbacks.
  @Test
  fun aDestroyedPluginStopsEverythingAndRegistersAndEmitsNothingMore() {
    val main = mutableListOf<() -> Unit>()
    val pluginThread = mutableListOf<() -> Unit>()
    val plugin = plugin(runOnMain = { main += it }, runOnPluginThread = { pluginThread += it })
    val click = listener(plugin, "click")
    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.startEvents(call("startEvents", "kind" to "permission"))
    plugin.startEvents(call("startEvents", "kind" to "log"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 1))
    main.drain()
    val handle = holdAForegroundNotification(plugin, pluginThread, main)
    val logListener = native.logListeners.keys.single()
    val clickListener = native.clickListeners.single()
    val foregroundListener = native.foregroundListeners.single()
    clickListener.onClick(NativeValues.click(testNotification(), null, null))
    pluginThread.drain()
    assertEquals(1, click.resolved.size)
    plugin.startEvents(call("startEvents", "kind" to "user"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 2))

    plugin.handleOnDestroy()
    main.drain()
    pluginThread.drain()
    clickListener.onClick(NativeValues.click(testNotification(), null, null))
    val lateForeground = NativeValues.willDisplay(testNotification())
    foregroundListener.onWillDisplay(lateForeground)
    logListener.onLogEvent(
      NativeValues.logEvent(SallaPushLogLevel.ERROR, "registration", "register.failed", "Failed.", emptyMap(), 0L)
    )
    plugin.setLogHandlerLevel(call("setLogHandlerLevel", "level" to "verbose"))
    plugin.startEvents(call("startEvents", "kind" to "click"))
    plugin.addPushSubscriptionListener(call("addPushSubscriptionListener", "listenerId" to 3))
    plugin.displayNotification(call("displayNotification", "handle" to handle))
    main.drain()
    pluginThread.drain()

    assertTrue(native.clickListeners.isEmpty())
    assertTrue(native.foregroundListeners.isEmpty())
    assertTrue(native.permissionObservers.isEmpty())
    assertTrue(native.userObservers.isEmpty())
    assertTrue(native.subscriptionObservers.isEmpty())
    assertTrue(native.logListeners.isEmpty())
    assertEquals(
      listOf(
        "addClickListener",
        "addPermissionObserver",
        "addLogListener(WARN)",
        "addSubscriptionObserver",
        "addForegroundLifecycleListener",
        "removeClickListener",
        "removePermissionObserver",
        "removeLogListener",
        "removeForegroundLifecycleListener",
        "removeSubscriptionObserver",
      ),
      native.calls
    )
    assertEquals(1, click.resolved.size)
    assertFalse(lateForeground.isPrevented)
    assertTrue(native.displayed.isEmpty())
  }

  private fun plugin(
    earlyInit: StaticConfig? = null,
    native: NativeSallaPush = this.native,
    pluginConfigIsEmpty: Boolean = true,
    runOnMain: (() -> Unit) -> Unit = { it() },
    runOnPluginThread: (() -> Unit) -> Unit = { it() },
  ) = SallaPushPlugin(
    SallaPushPlugin.Seams(
      native = native,
      once = once,
      earlyInit = { earlyInit },
      context = context,
      runOnMain = runOnMain,
      runOnPluginThread = runOnPluginThread,
      pluginConfigIsEmpty = { pluginConfigIsEmpty },
    )
  )

  /** A listener as JavaScript adds it: Capacitor's own addListener, which keeps the call and resolves it per event. */
  private fun listener(plugin: SallaPushPlugin, eventName: String) =
    RecordingCall("addListener", json("eventName" to eventName)).also(plugin::addListener)

  /**
   * Holds a foreground notification for a will-display listener, as JavaScript would, and returns its handle; the
   * threads the plugin posts to are run as it goes.
   */
  private fun holdAForegroundNotification(
    plugin: SallaPushPlugin,
    pluginThread: MutableList<() -> Unit> = mutableListOf(),
    main: MutableList<() -> Unit> = mutableListOf(),
  ): String {
    val willDisplay = listener(plugin, "willDisplay")
    plugin.startEvents(call("startEvents", "kind" to "willDisplay"))
    main.drain()
    native.foregroundListeners.single().onWillDisplay(NativeValues.willDisplay(testNotification()))
    pluginThread.drain()
    return checkNotNull(willDisplay.resolved.single().getString("handle"))
  }

  /** Runs, in order, what the plugin posted to a thread. */
  private fun MutableList<() -> Unit>.drain() {
    val posted = toList()
    clear()
    posted.forEach { it() }
  }

  /** A call as JavaScript sends it: its options in a JSObject, null values as JSON null. */
  private fun call(method: String, vararg options: Pair<String, Any?>) = RecordingCall(method, json(*options))

  private fun json(vararg entries: Pair<String, Any?>) =
    JSObject().apply { entries.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } }

  /** The `value` a request resolved once, with JSON null as null. */
  private fun resolved(data: JSObject = JSObject(), invoke: (PluginCall) -> Unit): Any? {
    val call = RecordingCall("request", data)
    invoke(call)
    assertTrue(call.rejected.isEmpty())
    return call.resolved.single().opt("value").takeUnless { it == JSONObject.NULL }
  }

  private fun errors(): List<String> = logs(Log.ERROR)

  private fun infos(): List<String> = logs(Log.INFO)

  private fun logs(type: Int): List<String> =
    ShadowLog.getLogsForTag("SallaPush").filter { it.type == type }.map { it.msg }
}
