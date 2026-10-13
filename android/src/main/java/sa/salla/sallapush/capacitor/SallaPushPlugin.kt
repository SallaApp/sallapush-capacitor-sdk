package sa.salla.sallapush.capacitor

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.salla.push.SallaPushConfig
import org.json.JSONObject

/**
 * The SallaPush plugin that Capacitor loads; apps use the TypeScript API. Capacitor calls its methods on its plugin
 * thread, in call order, and SallaPush is thread-safe, so every call goes straight to native.
 */
@CapacitorPlugin(name = "SallaPush")
class SallaPushPlugin internal constructor(private val seams: Seams) : Plugin() {

  /** The public no-argument constructor Capacitor creates the plugin with (PluginHandle, by reflection). */
  constructor() : this(Seams())

  /** What the tests replace; the defaults are the live ones. */
  internal class Seams(
    val native: NativeSallaPush = LiveNativeSallaPush,
    val once: OncePerProcess = OncePerProcess.shared,
    val earlyInit: () -> StaticConfig? = { EarlyInit.config },
    val context: Context? = null, // null: the bridge context's applicationContext
    val pluginConfigIsEmpty: (() -> Boolean)? = null, // null: getConfig().isEmpty(), which needs a bridge
  )

  /**
   * Starts nothing: SallaPushInitProvider started SallaPush from the manifest when the process started. A
   * plugins.SallaPush section of capacitor.config, which the plugin never reads, gets one error per process.
   */
  override fun load() {
    val configIsEmpty = seams.pluginConfigIsEmpty?.invoke() ?: getConfig().isEmpty()
    if (!configIsEmpty) seams.once.error(IGNORED_CONFIG)
  }

  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun initialize(call: PluginCall) {
    val appId = call.getString("appId") ?: return
    val options = InitOptions(call.getObject("config") ?: JSObject())
    if (seams.earlyInit()?.appId == appId && options.apiBaseUrl == null) {
      reportIgnoredOptions(options.startOptions)
    }
    seams.native.initWithContext(applicationContext(), appId, options.toSallaPushConfig())
  }

  @PluginMethod
  fun isInitialized(call: PluginCall) = call.resolveWith { seams.native.isInitialized }

  @PluginMethod
  fun getSallaPushAppId(call: PluginCall) = call.resolveWith { seams.native.appId }

  @PluginMethod
  fun getSdkVersion(call: PluginCall) = call.resolveWith { seams.native.sdkVersion }

  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun setConsentRequired(call: PluginCall) {
    val required = call.getBoolean("required") ?: return
    val earlyInit = seams.earlyInit()
    if (required && earlyInit != null && earlyInit.requiresUserConsent != true) {
      val key = StaticConfig.REQUIRES_USER_CONSENT
      Console.error(
        "setConsentRequired(true) came after SallaPush started from ${StaticConfig.APP_ID} without $key, so the " +
          "device may already have registered and sent data. Set $key to true in the manifest to require consent " +
          "from the start."
      )
    }
    seams.native.setConsentRequired(required)
  }

  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun setConsentGiven(call: PluginCall) {
    val given = call.getBoolean("given") ?: return
    seams.native.setConsentGiven(given)
  }

  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun login(call: PluginCall) {
    val externalId = call.getString("externalId") ?: return
    val identityToken = call.getString("identityToken") ?: return
    seams.native.login(externalId, identityToken)
  }

  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun logout(call: PluginCall) {
    seams.native.logout()
  }

  /** The application context, which native keeps; the bridge's context is the activity. */
  private fun applicationContext(): Context = seams.context ?: context.applicationContext

  /** A second init with the static app id and API host changes nothing natively, its options included. */
  private fun reportIgnoredOptions(options: List<Pair<String, String>>) {
    if (options.isEmpty()) return
    val names = options.joinToString(", ") { it.first }
    val keys = options.joinToString(", ") { it.second }
    Console.error(
      "initialize ignored $names: SallaPush already started with this app id from ${StaticConfig.APP_ID}, so the " +
        "call changes nothing. Set them with the meta-data $keys instead."
    )
  }
}

/** The options of a JavaScript initialize call that apply on Android; null means the option was left out. */
private class InitOptions(config: JSONObject) {
  val apiBaseUrl = config.stringOrNull("apiBaseUrl")
  val logLevel = config.stringOrNull("logLevel")?.let(::logLevelNamed)
  val appVersion = config.stringOrNull("appVersion")
  val clearTagsOnLogout = config.booleanOrNull("clearTagsOnLogout")
  val requiresUserConsent = config.booleanOrNull("requiresUserConsent")
  val openLaunchUrls = config.booleanOrNull("openLaunchUrls")

  /** The given options that only the first init applies, each with the meta-data that sets it at launch. */
  val startOptions: List<Pair<String, String>>
    get() = listOfNotNull(
      logLevel?.let { "logLevel" to "com.salla.push.LOG_LEVEL" },
      appVersion?.let { "appVersion" to StaticConfig.APP_VERSION },
      clearTagsOnLogout?.let { "clearTagsOnLogout" to StaticConfig.CLEAR_TAGS_ON_LOGOUT },
      requiresUserConsent?.let { "requiresUserConsent" to StaticConfig.REQUIRES_USER_CONSENT },
      openLaunchUrls?.let { "openLaunchUrls" to StaticConfig.OPEN_LAUNCH_URLS },
    )

  /** The native configuration with the options that were given, and native's defaults for the others. */
  fun toSallaPushConfig(): SallaPushConfig {
    val builder = SallaPushConfig.Builder()
    apiBaseUrl?.let { builder.setApiBaseUrl(it) }
    logLevel?.let { builder.setLogLevel(it) }
    appVersion?.let { builder.setAppVersion(it) }
    clearTagsOnLogout?.let { builder.setClearTagsOnLogout(it) }
    requiresUserConsent?.let { builder.setRequiresUserConsent(it) }
    openLaunchUrls?.let { builder.setOpenLaunchUrls(it) }
    return builder.build()
  }
}

private const val INTERNAL_ERROR = "E_SALLAPUSH_INTERNAL"

private const val IGNORED_CONFIG = "capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its " +
  "settings from the Info.plist keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and " +
  "Android setup)."

/**
 * Resolves `{ value }`, with null as JSON null; a bridge failure, which native never causes, rejects with
 * E_SALLAPUSH_INTERNAL.
 */
private inline fun PluginCall.resolveWith(value: () -> Any?) {
  try {
    resolve(JSObject().put("value", value() ?: JSONObject.NULL))
  } catch (e: Exception) {
    reject("SallaPush failed: $e", INTERNAL_ERROR, e)
  }
}

// An option that is absent, JSON null or mistyped is left out, so native keeps its default. The optString family would
// read an absent option as "" or false, and getBoolean would throw on a mistyped one.
private fun JSONObject.stringOrNull(key: String): String? = if (has(key) && !isNull(key)) opt(key) as? String else null

private fun JSONObject.booleanOrNull(key: String): Boolean? = if (has(key) && !isNull(key)) opt(key) as? Boolean else null
