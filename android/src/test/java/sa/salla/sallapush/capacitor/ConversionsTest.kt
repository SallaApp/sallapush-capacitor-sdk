package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.salla.push.SallaPushPayloadSource
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ConversionsTest {

  @Test
  fun keepsStringsAndWritesObjectsAndArraysAsJsonText() {
    val data = Conversions.messageData(
      JSObject("""{"sp_v":"1","custom":{"i":"os-id","a":{"push_ref":"msg_1a2b","count":2}},"tags":["vip",3]}""")
    )

    assertEquals("1", data["sp_v"])
    val custom = JSONObject(data.getValue("custom"))
    assertEquals("os-id", custom.getString("i"))
    assertEquals("msg_1a2b", custom.getJSONObject("a").getString("push_ref"))
    assertEquals(2, custom.getJSONObject("a").getInt("count"))
    val tags = JSONArray(data.getValue("tags"))
    assertEquals("vip", tags.getString(0))
    assertEquals(3, tags.getInt(1))
  }

  @Test
  fun writesOtherValuesAsTextAndDropsNulls() {
    val data = Conversions.messageData(JSObject("""{"count":3,"ratio":1.5,"vip":true,"none":null}"""))

    assertEquals(mapOf("count" to "3", "ratio" to "1.5", "vip" to "true"), data)
  }

  @Test
  fun nativeRecognizesConvertedPayloads() {
    val compat = JSObject("""{"alert":"Hi","custom":{"i":"os-id","a":{"push_ref":"msg_1a2b"}}}""")
    val native = JSObject("""{"sp_v":"1","sp_id":"msg_1a2b","sp_title":"Hi"}""")
    val foreign = JSObject("""{"alert":"Hi","custom":{"i":"os-id","a":{"campaign":"spring"}}}""")

    assertTrue(LiveNativeSallaPush.isSallaPushMessage(Conversions.messageData(compat)))
    assertTrue(LiveNativeSallaPush.isSallaPushMessage(Conversions.messageData(native)))
    assertFalse(LiveNativeSallaPush.isSallaPushMessage(Conversions.messageData(foreign)))
  }

  @Test
  fun passesTheTagEntriesUncheckedWithJsonNullAsNull() {
    val entries = Conversions.entries(
      JSObject("""{"level":"gold","visits":3,"vip":true,"note":null,"offer":{"id":7}}""")
    )

    assertEquals(setOf("level", "visits", "vip", "note", "offer"), entries.keys)
    assertEquals("gold", entries["level"])
    assertEquals(3, entries["visits"])
    assertEquals(true, entries["vip"])
    assertTrue(entries.containsKey("note"))
    assertNull(entries["note"])
    assertEquals(7, (entries["offer"] as JSONObject).getInt("id"))
  }

  @Test
  fun passesTheTagKeysUncheckedInOrderWithJsonNullAsNull() {
    assertEquals(listOf("level", 3, null, true), Conversions.items(JSArray("""["level",3,null,true]""")))
    assertEquals(emptyList<Any?>(), Conversions.items(JSArray()))
  }

  // JSObject.put(key, null) removes the key, so a null must become JSON null for JavaScript to get it, as on iOS.
  @Test
  fun keepsEveryNullAsJsonNullAndEveryListAtItsLength() {
    val json = Conversions.toJSObject(mapOf("a" to null, "b" to listOf(1, null, 3)))

    assertEquals(setOf("a", "b"), json.keys().asSequence().toSet())
    assertTrue(json.isNull("a"))
    val b = json.getJSONArray("b")
    assertEquals(3, b.length())
    assertEquals(1, b.getInt(0))
    assertTrue(b.isNull(1))
    assertEquals(3, b.getInt(2))
    assertEquals("""{"a":null,"b":[1,null,3]}""", json.toString())
  }

  @Test
  fun convertsNestedMapsAndListsAtEveryLevel() {
    val json = Conversions.toJSObject(
      mapOf(
        "notification" to mapOf(
          "additionalData" to mapOf("offer" to mapOf("items" to listOf(mapOf("sku" to "A-1", "note" to null), "x"))),
          "badge" to null,
        ),
        "count" to 3L,
        "ratio" to 0.5,
        "flag" to false,
      )
    )

    val notification = json.getJSONObject("notification")
    val items = notification.getJSONObject("additionalData").getJSONObject("offer").getJSONArray("items")
    assertEquals("A-1", items.getJSONObject(0).getString("sku"))
    assertTrue(items.getJSONObject(0).has("note"))
    assertTrue(items.getJSONObject(0).isNull("note"))
    assertEquals("x", items.getString(1))
    assertTrue(notification.isNull("badge"))
    assertEquals(3L, json.getLong("count"))
    assertEquals(0.5, json.getDouble("ratio"), 0.0)
    assertFalse(json.getBoolean("flag"))
  }

  @Test
  fun turnsAListIntoAJsArrayOfTheSameLength() {
    val array = Conversions.toJSArray(listOf(null, "a", listOf(null), mapOf("k" to null)))

    assertEquals("""[null,"a",[null],{"k":null}]""", array.toString())
    assertEquals("[]", Conversions.toJSArray(emptyList<Any?>()).toString())
  }

  @Test
  fun anEventBodyReachesJavaScriptAsMappingBuiltIt() {
    val notification = testNotification(
      source = SallaPushPayloadSource.COMPAT,
      additionalData = mapOf("a" to null, "b" to listOf(1, null, 3), "id" to 42),
    )

    val json = Conversions.toJSObject(Mapping.click(NativeValues.click(notification, null, "https://example.com/x")))

    val additionalData = json.getJSONObject("notification").getJSONObject("additionalData")
    assertEquals("""{"a":null,"b":[1,null,3],"id":42}""", additionalData.toString())
    assertEquals("https://example.com/x", json.getString("url"))
    assertFalse(json.has("actionId"))
    assertEquals(42L, json.getJSONObject("notification").getJSONObject("intValues").getLong("id"))
  }
}
