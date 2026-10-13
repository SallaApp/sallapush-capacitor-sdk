package sa.salla.sallapush.capacitor

import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginResult

/**
 * A plugin call as JavaScript makes it, without Capacitor's message handler, that records how the plugin settled it.
 * resolve(…), successCallback and errorCallback send through the handler, and every other reject overload,
 * unimplemented and unavailable end in the four-argument reject, so these five are overridden.
 */
internal class RecordingCall(method: String, data: JSObject = JSObject()) :
  PluginCall(null, "SallaPush", "test", method, data) {

  /** The data of each resolve, in order; resolve() without data records an empty object. */
  val resolved = mutableListOf<JSObject>()

  /** The message and the code of each rejection, in order; errorCallback has no code. */
  val rejected = mutableListOf<Pair<String?, String?>>()

  override fun resolve(data: JSObject?) {
    resolved += data ?: JSObject()
  }

  override fun resolve() {
    resolved += JSObject()
  }

  override fun successCallback(successResult: PluginResult?) {
    resolved += successResult?.let { JSObject(it.toString()) } ?: JSObject()
  }

  override fun errorCallback(msg: String?) {
    rejected += msg to null
  }

  override fun reject(msg: String?, code: String?, ex: Exception?, data: JSObject?) {
    rejected += msg to code
  }
}
