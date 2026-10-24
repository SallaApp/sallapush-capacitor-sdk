package sa.salla.sallapush.capacitor

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri

/**
 * Starts SallaPush natively from the app's manifest in every main-process start, before Application.onCreate, so
 * processes that FCM or a tap starts without JavaScript behave as in a native app. It provides no data.
 */
class SallaPushInitProvider : ContentProvider() {

  internal var native: NativeSallaPush = LiveNativeSallaPush

  override fun onCreate(): Boolean {
    val context = context ?: return true
    EarlyInit.start(context, StaticConfig.read(context), native)
    return true
  }

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}

/** The native start from the static configuration, and what it did, which the JavaScript API's checks read. */
internal object EarlyInit {

  /** The static configuration SallaPush was started with in this process; null when no app id is set. */
  @Volatile
  var config: StaticConfig? = null

  fun start(context: Context, config: StaticConfig, native: NativeSallaPush) {
    // Native shows FCM messages before and without init, so the flag applies with or without an app id.
    config.displayCompatPayloads?.let { native.setDisplayCompatPayloads(it) }
    val appId = config.appId ?: return
    native.initWithContext(context, appId, config.toSallaPushConfig())
    this.config = config
  }
}
