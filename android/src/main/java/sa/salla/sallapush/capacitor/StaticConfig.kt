package sa.salla.sallapush.capacitor

import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Resources
import android.os.Build
import android.os.Bundle
import com.salla.push.SallaPushConfig
import java.util.Locale

/**
 * The com.salla.push.* meta-data that only the wrapper reads, from the app's manifest. Null means the key is absent and
 * native's default applies. SallaPush reads its own keys (LOG_LEVEL, the icon and channel keys) itself.
 */
internal data class StaticConfig(
  val appId: String? = null,
  val openLaunchUrls: Boolean? = null,
  val requiresUserConsent: Boolean? = null,
  val clearTagsOnLogout: Boolean? = null,
  val appVersion: String? = null,
  val displayCompatPayloads: Boolean? = null,
  val autoClearBadge: Boolean? = null,
  val autoUpdateBadge: Boolean? = null,
) {

  /** The native configuration with the options the manifest sets, and native's defaults for the others. */
  fun toSallaPushConfig(): SallaPushConfig {
    val builder = SallaPushConfig.Builder()
    openLaunchUrls?.let { builder.setOpenLaunchUrls(it) }
    requiresUserConsent?.let { builder.setRequiresUserConsent(it) }
    clearTagsOnLogout?.let { builder.setClearTagsOnLogout(it) }
    appVersion?.let { builder.setAppVersion(it) }
    autoClearBadge?.let { builder.setAutoClearBadge(it) }
    autoUpdateBadge?.let { builder.setAutoUpdateBadge(it) }
    return builder.build()
  }

  companion object {
    const val APP_ID = "com.salla.push.APP_ID"
    const val OPEN_LAUNCH_URLS = "com.salla.push.OPEN_LAUNCH_URLS"
    const val REQUIRES_USER_CONSENT = "com.salla.push.REQUIRES_USER_CONSENT"
    const val CLEAR_TAGS_ON_LOGOUT = "com.salla.push.CLEAR_TAGS_ON_LOGOUT"
    const val APP_VERSION = "com.salla.push.APP_VERSION"
    const val DISPLAY_COMPAT_PAYLOADS = "com.salla.push.DISPLAY_COMPAT_PAYLOADS"
    const val AUTO_CLEAR_BADGE = "com.salla.push.AUTO_CLEAR_BADGE"
    const val AUTO_UPDATE_BADGE = "com.salla.push.AUTO_UPDATE_BADGE"

    fun read(context: Context): StaticConfig = from(context, metaData(context))

    fun from(context: Context, metaData: Bundle?): StaticConfig {
      val values = MetaData(context, metaData ?: Bundle.EMPTY)
      return StaticConfig(
        appId = values.text(APP_ID),
        openLaunchUrls = values.flag(OPEN_LAUNCH_URLS),
        requiresUserConsent = values.flag(REQUIRES_USER_CONSENT),
        clearTagsOnLogout = values.flag(CLEAR_TAGS_ON_LOGOUT),
        appVersion = values.text(APP_VERSION),
        displayCompatPayloads = values.flag(DISPLAY_COMPAT_PAYLOADS),
        autoClearBadge = values.flag(AUTO_CLEAR_BADGE),
        autoUpdateBadge = values.flag(AUTO_UPDATE_BADGE),
      )
    }

    private fun metaData(context: Context): Bundle? = try {
      val manager = context.packageManager
      val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        manager.getApplicationInfo(
          context.packageName,
          PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong())
        )
      } else {
        @Suppress("DEPRECATION")
        manager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      }
      info.metaData
    } catch (e: Exception) {
      Console.error("Couldn't read the app's meta-data, so SallaPush doesn't start from it: $e")
      null
    }
  }

  /** AAPT types each android:value, so every key is read to text by its type, then parsed. */
  private class MetaData(private val context: Context, private val bundle: Bundle) {

    fun text(key: String): String? {
      @Suppress("DEPRECATION")
      val value = bundle.get(key) ?: return null
      val text = when (value) {
        is String -> value
        is Int -> try {
          context.getString(value)
        } catch (e: Resources.NotFoundException) {
          value.toString()
        }
        is Boolean -> value.toString()
        else -> {
          Console.error(
            "Ignored $key: Android stores its value as a ${value.javaClass.simpleName}. " +
              "Put the value in a string resource and use android:value=\"@string/…\"."
          )
          return null
        }
      }
      return text.trim().ifEmpty { null }
    }

    fun flag(key: String): Boolean? {
      val text = text(key) ?: return null
      return when (text.lowercase(Locale.ROOT)) {
        "true", "yes", "1" -> true
        "false", "no", "0" -> false
        else -> {
          Console.error("Ignored $key: \"$text\" is not true, false, YES, NO, 1 or 0.")
          null
        }
      }
    }
  }
}
