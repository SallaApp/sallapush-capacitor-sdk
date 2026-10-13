package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
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
}
