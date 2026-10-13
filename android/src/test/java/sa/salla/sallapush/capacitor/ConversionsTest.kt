package sa.salla.sallapush.capacitor

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ConversionsTest {

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
