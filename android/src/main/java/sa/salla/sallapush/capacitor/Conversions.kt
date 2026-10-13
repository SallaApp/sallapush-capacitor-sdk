package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import org.json.JSONObject

/** JavaScript values, as Capacitor's JSObject and JSArray hold them, turned into what native's calls take. */
internal object Conversions {

  /** An FCM-style data map: strings kept, objects and arrays as JSON text, other values as text, nulls dropped. */
  fun messageData(payload: JSONObject): Map<String, String> = buildMap {
    for (key in payload.keys()) {
      val value = payload.opt(key)
      if (value != null && value != JSONObject.NULL) put(key, value.toString())
    }
  }

  /** addTags' entries, unchecked and with JSON null as null: native skips and logs the ones that aren't strings. */
  fun entries(json: JSONObject): Map<String, Any?> = buildMap {
    for (key in json.keys()) put(key, json.opt(key).takeUnless { it == JSONObject.NULL })
  }

  /** removeTags' keys, unchecked and with JSON null as null: native skips and logs the ones that aren't strings. */
  fun items(json: JSArray): List<Any?> = List(json.length()) { index ->
    json.opt(index).takeUnless { it == JSONObject.NULL }
  }
}
