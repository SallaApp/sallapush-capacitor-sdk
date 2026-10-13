package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import org.json.JSONObject

/** JavaScript values, as Capacitor's JSObject and JSArray hold them, turned into what native's calls take. */
internal object Conversions {

  /** The entries of addTags' object, unchecked and with JSON null as null: native skips the ones that aren't strings. */
  fun entries(json: JSONObject): Map<String, Any?> = buildMap {
    for (key in json.keys()) put(key, json.opt(key).takeUnless { it == JSONObject.NULL })
  }

  /** The items of removeTags' array, unchecked and with JSON null as null: native skips the ones that aren't strings. */
  fun items(json: JSArray): List<Any?> = List(json.length()) { index ->
    json.opt(index).takeUnless { it == JSONObject.NULL }
  }
}
