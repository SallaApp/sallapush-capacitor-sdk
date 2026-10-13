package sa.salla.sallapush.capacitor

import android.content.Context
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginResult
import com.salla.push.SallaPushConfig
import com.salla.push.SallaPushLogLevel
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
          "iosAppGroupIdentifier" to "group.sa.salla.example",
          "iosAutoClearBadge" to false,
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
    assertTrue(errors().isEmpty())
  }

  // Each boolean alone, at the value that isn't native's default, so options swapped with each other can't pass.
  @Test
  fun passesEachBooleanOptionAloneAndLeavesTheOthersAtNativesDefaults() {
    val options = mapOf<String, (SallaPushConfig) -> Boolean>(
      "clearTagsOnLogout" to { it.clearTagsOnLogout },
      "requiresUserConsent" to { it.requiresUserConsent },
      "openLaunchUrls" to { it.openLaunchUrls },
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
        "config" to json("appVersion" to 2, "openLaunchUrls" to "yes", "requiresUserConsent" to 1),
      )
    )

    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
    val config = native.initConfigs.single()
    assertNull(config.appVersion)
    assertFalse(config.openLaunchUrls)
    assertFalse(config.requiresUserConsent)
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
        ),
      )
    )

    assertEquals(
      listOf(
        "[SallaPush] initialize ignored logLevel, appVersion, clearTagsOnLogout, requiresUserConsent, openLaunchUrls: " +
          "SallaPush already started with this app id from com.salla.push.APP_ID, so the call changes nothing. Set " +
          "them with the meta-data com.salla.push.LOG_LEVEL, com.salla.push.APP_VERSION, " +
          "com.salla.push.CLEAR_TAGS_ON_LOGOUT, com.salla.push.REQUIRES_USER_CONSENT, " +
          "com.salla.push.OPEN_LAUNCH_URLS instead."
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

  private fun plugin(
    earlyInit: StaticConfig? = null,
    native: NativeSallaPush = this.native,
    pluginConfigIsEmpty: Boolean = true,
  ) = SallaPushPlugin(
    SallaPushPlugin.Seams(
      native = native,
      once = once,
      earlyInit = { earlyInit },
      context = context,
      pluginConfigIsEmpty = { pluginConfigIsEmpty },
    )
  )

  /** A call as JavaScript sends it: its options in a JSObject, null values as JSON null. */
  private fun call(method: String, vararg options: Pair<String, Any?>) = RecordingCall(method, json(*options))

  private fun json(vararg entries: Pair<String, Any?>) =
    JSObject().apply { entries.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } }

  /** The `value` a request resolved once, with JSON null as null. */
  private fun resolved(invoke: (PluginCall) -> Unit): Any? {
    val call = RecordingCall("request")
    invoke(call)
    assertTrue(call.rejected.isEmpty())
    return call.resolved.single().opt("value").takeUnless { it == JSONObject.NULL }
  }

  private fun errors(): List<String> = logs(Log.ERROR)

  private fun logs(type: Int): List<String> =
    ShadowLog.getLogsForTag("SallaPush").filter { it.type == type }.map { it.msg }
}
