package sa.salla.sallapush.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
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

  @PluginMethod
  fun getSdkVersion(call: PluginCall) = call.resolveWith { seams.native.sdkVersion }
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
