package sa.salla.sallapush.capacitor

import android.util.Log
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowLog

@RunWith(RobolectricTestRunner::class)
class DisplayStoreTest {
  private val native = FakeNativeSallaPush()
  private var now = 1_800_000_000_000L
  private val store = DisplayStore(native) { now }

  @Before
  fun clearLog() {
    ShadowLog.clear()
  }

  @Test
  fun holdsEachNotificationUnderANewRandomHandle() {
    val first = store.put(testNotification())
    val second = store.put(testNotification())

    assertNotEquals(first, second)
    assertNotNull(UUID.fromString(first))
  }

  @Test
  fun displaysTheVeryObjectItHeldOnce() {
    val held = testNotification()
    val handle = store.put(held)

    assertTrue(store.display(handle))
    assertFalse(store.display(handle))

    assertSame(held, native.displayed.single())
    assertEquals(listOf(REFUSED), warnings())
  }

  @Test
  fun anUnknownHandleDisplaysNothing() {
    assertFalse(store.display("8d1e3d0a-1a1b-4c63-9d38-4c2b2b7e5f10"))

    assertTrue(native.displayed.isEmpty())
    assertEquals(listOf(REFUSED), warnings())
  }

  @Test
  fun displaysWithinNativesTenMinuteWindowOnly() {
    val onTime = store.put(testNotification())
    now += 600_000
    assertTrue(store.display(onTime))

    val late = store.put(testNotification())
    now += 600_001
    assertFalse(store.display(late))

    assertEquals(1, native.displayed.size)
  }

  @Test
  fun keepsFarMoreThanTwentyAndDropsTheOldestOnlyPastFiveHundred() {
    val handles = List(DisplayStore.CAPACITY + 1) { store.put(testNotification()) }

    assertFalse(store.display(handles.first()))
    handles.drop(1).forEach { assertTrue(store.display(it)) }

    assertEquals(500, native.displayed.size)
  }

  @Test
  fun clearForgetsEveryNotification() {
    val handle = store.put(testNotification())

    store.clear()

    assertFalse(store.display(handle))
    assertTrue(native.displayed.isEmpty())
  }

  private fun warnings(): List<String> =
    ShadowLog.getLogsForTag("SallaPush").filter { it.type == Log.WARN }.map { it.msg }

  private companion object {
    const val REFUSED = "[SallaPush] SallaPushNotification.display() did nothing: a prevented notification is shown " +
      "once, within 10 minutes of its foregroundWillDisplay event."
  }
}
