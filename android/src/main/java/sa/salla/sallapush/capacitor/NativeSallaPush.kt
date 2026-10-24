package sa.salla.sallapush.capacitor

import android.content.Context
import com.salla.push.SallaPush
import com.salla.push.SallaPushClickListener
import com.salla.push.SallaPushConfig
import com.salla.push.SallaPushForegroundLifecycleListener
import com.salla.push.SallaPushLogLevel
import com.salla.push.SallaPushLogListener
import com.salla.push.SallaPushNotification
import com.salla.push.SallaPushPermissionObserver
import com.salla.push.SallaPushSubscriptionObserver
import com.salla.push.SallaPushUserObserver
import org.json.JSONObject

/** The native SallaPush calls the wrapper makes. Tests replace it with a fake. */
internal interface NativeSallaPush {
  fun initWithContext(context: Context, appId: String, config: SallaPushConfig)

  val isInitialized: Boolean

  val appId: String?

  val sdkVersion: String

  fun setConsentRequired(required: Boolean)

  fun setConsentGiven(given: Boolean)

  fun login(externalId: String, identityToken: String)

  fun logout()

  val externalId: String?

  val isLoggedIn: Boolean

  fun addTag(key: String, value: String)

  /** Native skips and logs the entries that aren't strings. */
  fun addTags(tags: Map<String, String>)

  fun removeTag(key: String)

  /** Native skips and logs the keys that aren't strings. */
  fun removeTags(keys: Collection<String>)

  val tags: Map<String, String>

  fun setLanguage(language: String?)

  fun addUserObserver(observer: SallaPushUserObserver)

  fun removeUserObserver(observer: SallaPushUserObserver)

  val pushSubscriptionId: String?

  val pushSubscriptionToken: String?

  val pushSubscriptionOptedIn: Boolean

  fun optIn()

  fun optOut()

  fun addSubscriptionObserver(observer: SallaPushSubscriptionObserver)

  fun removeSubscriptionObserver(observer: SallaPushSubscriptionObserver)

  val permission: Boolean

  fun canRequestPermission(): Boolean

  fun requestPermission(fallbackToSettings: Boolean, callback: (Boolean) -> Unit)

  fun refreshPermission()

  fun clearAllNotifications()

  fun removeNotification(androidNotificationId: Int)

  fun isSallaPushMessage(data: Map<String, String>): Boolean

  fun trackOpened(additionalData: JSONObject?): Boolean

  fun addClickListener(listener: SallaPushClickListener)

  fun removeClickListener(listener: SallaPushClickListener)

  /** Native calls [listener] on the main thread before a SallaPush notification shows in the foreground. */
  fun addForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener)

  fun removeForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener)

  fun display(notification: SallaPushNotification)

  fun addPermissionObserver(observer: SallaPushPermissionObserver)

  fun removePermissionObserver(observer: SallaPushPermissionObserver)

  fun setDisplayCompatPayloads(display: Boolean)

  var logLevel: SallaPushLogLevel

  /** Native calls [listener] on its own thread; adding the same listener again changes its level. */
  fun addLogListener(listener: SallaPushLogListener, level: SallaPushLogLevel)

  fun removeLogListener(listener: SallaPushLogListener)
}

internal object LiveNativeSallaPush : NativeSallaPush {
  override fun initWithContext(context: Context, appId: String, config: SallaPushConfig) {
    SallaPush.initWithContext(context, appId, config)
  }

  override val isInitialized: Boolean
    get() = SallaPush.isInitialized

  override val appId: String?
    get() = SallaPush.appId

  override val sdkVersion: String
    get() = SallaPush.sdkVersion

  override fun setConsentRequired(required: Boolean) {
    SallaPush.setConsentRequired(required)
  }

  override fun setConsentGiven(given: Boolean) {
    SallaPush.setConsentGiven(given)
  }

  override fun login(externalId: String, identityToken: String) {
    SallaPush.login(externalId, identityToken)
  }

  override fun logout() {
    SallaPush.logout()
  }

  override val externalId: String?
    get() = SallaPush.User.externalId

  override val isLoggedIn: Boolean
    get() = SallaPush.User.isLoggedIn

  override fun addTag(key: String, value: String) {
    SallaPush.User.addTag(key, value)
  }

  override fun addTags(tags: Map<String, String>) {
    SallaPush.User.addTags(tags)
  }

  override fun removeTag(key: String) {
    SallaPush.User.removeTag(key)
  }

  override fun removeTags(keys: Collection<String>) {
    SallaPush.User.removeTags(keys)
  }

  override val tags: Map<String, String>
    get() = SallaPush.User.getTags()

  override fun setLanguage(language: String?) {
    SallaPush.User.setLanguage(language)
  }

  override fun addUserObserver(observer: SallaPushUserObserver) {
    SallaPush.User.addObserver(observer)
  }

  override fun removeUserObserver(observer: SallaPushUserObserver) {
    SallaPush.User.removeObserver(observer)
  }

  override val pushSubscriptionId: String?
    get() = SallaPush.User.pushSubscription.id

  override val pushSubscriptionToken: String?
    get() = SallaPush.User.pushSubscription.token

  override val pushSubscriptionOptedIn: Boolean
    get() = SallaPush.User.pushSubscription.optedIn

  override fun optIn() {
    SallaPush.User.pushSubscription.optIn()
  }

  override fun optOut() {
    SallaPush.User.pushSubscription.optOut()
  }

  override fun addSubscriptionObserver(observer: SallaPushSubscriptionObserver) {
    SallaPush.User.pushSubscription.addObserver(observer)
  }

  override fun removeSubscriptionObserver(observer: SallaPushSubscriptionObserver) {
    SallaPush.User.pushSubscription.removeObserver(observer)
  }

  override val permission: Boolean
    get() = SallaPush.Notifications.permission

  override fun canRequestPermission(): Boolean = SallaPush.Notifications.canRequestPermission()

  override fun requestPermission(fallbackToSettings: Boolean, callback: (Boolean) -> Unit) {
    SallaPush.Notifications.requestPermission(fallbackToSettings) { callback(it) }
  }

  override fun refreshPermission() {
    SallaPush.Notifications.refreshPermission()
  }

  override fun clearAllNotifications() {
    SallaPush.Notifications.clearAllNotifications()
  }

  override fun removeNotification(androidNotificationId: Int) {
    SallaPush.Notifications.removeNotification(androidNotificationId)
  }

  override fun isSallaPushMessage(data: Map<String, String>): Boolean =
    SallaPush.Notifications.isSallaPushMessage(data)

  override fun trackOpened(additionalData: JSONObject?): Boolean =
    SallaPush.Notifications.trackOpened(additionalData)

  override fun addClickListener(listener: SallaPushClickListener) {
    SallaPush.Notifications.addClickListener(listener)
  }

  override fun removeClickListener(listener: SallaPushClickListener) {
    SallaPush.Notifications.removeClickListener(listener)
  }

  override fun addForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener) {
    SallaPush.Notifications.addForegroundLifecycleListener(listener)
  }

  override fun removeForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener) {
    SallaPush.Notifications.removeForegroundLifecycleListener(listener)
  }

  override fun display(notification: SallaPushNotification) {
    notification.display()
  }

  override fun addPermissionObserver(observer: SallaPushPermissionObserver) {
    SallaPush.Notifications.addPermissionObserver(observer)
  }

  override fun removePermissionObserver(observer: SallaPushPermissionObserver) {
    SallaPush.Notifications.removePermissionObserver(observer)
  }

  override fun setDisplayCompatPayloads(display: Boolean) {
    SallaPush.Migration.setDisplayCompatPayloads(display)
  }

  override var logLevel: SallaPushLogLevel
    get() = SallaPush.Debug.logLevel
    set(value) {
      SallaPush.Debug.logLevel = value
    }

  override fun addLogListener(listener: SallaPushLogListener, level: SallaPushLogLevel) {
    SallaPush.Debug.addLogListener(listener, level)
  }

  override fun removeLogListener(listener: SallaPushLogListener) {
    SallaPush.Debug.removeLogListener(listener)
  }
}
