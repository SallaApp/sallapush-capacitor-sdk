package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONObject

/**
 * JavaScript values, as Capacitor's JSObject and JSArray hold them, turned into what native's calls take, and the plain
 * maps of Mapping turned into what JavaScript gets.
 */
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

  /**
   * A map as JavaScript gets it: nested maps and lists converted, and every null kept as JSON null, at every level, as
   * on iOS. JSObject.put(key, null) would remove the key instead.
   */
  fun toJSObject(map: Map<String, Any?>): JSObject = jsObject(map)

  /** A list as JavaScript gets it, of the same length: nested maps and lists converted, nulls kept as JSON null. */
  fun toJSArray(list: List<*>): JSArray = JSArray().apply { list.forEach { put(jsonValue(it)) } }

  private fun jsObject(map: Map<*, *>): JSObject =
    JSObject().apply { map.forEach { (key, value) -> put(key.toString(), jsonValue(value)) } }

  private fun jsonValue(value: Any?): Any = when (value) {
    null -> JSONObject.NULL
    is Map<*, *> -> jsObject(value)
    is List<*> -> toJSArray(value)
    else -> value
  }
}
