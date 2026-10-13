package sa.salla.sallapush.capacitor

import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/** The wrapper's own Logcat lines: tag SallaPush, prefixed [SallaPush]. */
internal object Console {
  private const val TAG = "SallaPush"

  fun error(message: String) {
    Log.e(TAG, "[SallaPush] $message")
  }

  fun warn(message: String) {
    Log.w(TAG, "[SallaPush] $message")
  }

  fun info(message: String) {
    Log.i(TAG, "[SallaPush] $message")
  }
}

/** The lines already printed in this process: a platform-only call prints its line once per process. */
internal class OncePerProcess {
  private val printed = ConcurrentHashMap.newKeySet<String>()

  fun info(message: String) {
    if (printed.add(message)) Console.info(message)
  }

  companion object {
    val shared = OncePerProcess()
  }
}
