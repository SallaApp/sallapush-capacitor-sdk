package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushNotification
import java.util.UUID

/**
 * The foreground notifications held for JavaScript's decision, by handle. It keeps the very object native's display()
 * belongs to, for native's 600 s display window, on native's wall clock. Native has no count limit, so the 500 entries
 * only bound memory, the oldest dropped first. Main thread only.
 */
internal class DisplayStore(
  private val native: NativeSallaPush,
  private val now: () -> Long = System::currentTimeMillis,
) {
  private class Entry(val notification: SallaPushNotification, val heldAtMillis: Long)

  private val entries = LinkedHashMap<String, Entry>()

  /** Holds [notification] under a new random handle: its notification id can be null. */
  fun put(notification: SallaPushNotification): String {
    dropExpired()
    val handle = UUID.randomUUID().toString()
    entries[handle] = Entry(notification, now())
    if (entries.size > CAPACITY) entries.remove(entries.keys.first())
    return handle
  }

  /** Shows the notification held under [handle], once; false, with a console line, for an unknown or expired handle. */
  fun display(handle: String): Boolean {
    dropExpired()
    val entry = entries.remove(handle)
    if (entry == null) {
      Console.warn(
        "SallaPushNotification.display() did nothing: a prevented notification is shown once, within 10 minutes of " +
          "its foregroundWillDisplay event."
      )
      return false
    }
    native.display(entry.notification)
    return true
  }

  fun clear() {
    entries.clear()
  }

  private fun dropExpired() {
    val current = now()
    entries.values.removeAll { current - it.heldAtMillis > WINDOW_MILLIS }
  }

  companion object {
    const val WINDOW_MILLIS = 600_000L
    const val CAPACITY = 500
  }
}
