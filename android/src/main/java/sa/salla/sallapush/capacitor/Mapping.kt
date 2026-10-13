package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushLogLevel
import java.util.Locale

/** The level as JavaScript names it, such as "debug". */
internal val SallaPushLogLevel.jsName: String
  get() = name.lowercase(Locale.ROOT)

/** The native level that JavaScript names [name]; null for any other text. */
internal fun logLevelNamed(name: String): SallaPushLogLevel? =
  SallaPushLogLevel.entries.firstOrNull { it.jsName == name }
