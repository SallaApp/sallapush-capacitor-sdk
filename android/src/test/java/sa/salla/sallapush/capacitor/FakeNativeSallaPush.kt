package sa.salla.sallapush.capacitor

import android.content.Context
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

/** Records every native call in order, with its arguments, and answers the getters with the values a test sets. */
internal class FakeNativeSallaPush : NativeSallaPush {
  val calls = mutableListOf<String>()
  val initContexts = mutableListOf<Context>()
  val initConfigs = mutableListOf<SallaPushConfig>()
  val addedTags = mutableListOf<Map<String, String>>()
  val removedTags = mutableListOf<Collection<String>>()
  val checkedMessages = mutableListOf<Map<String, String>>()
  val openedData = mutableListOf<JSONObject?>()
  var canRequest = false
  var permissionAnswer = false
  var recognizesMessages = false
  var tracksOpened = false
  override var isInitialized = false
  override var appId: String? = null
  override var sdkVersion = "1.0.2"
  override var externalId: String? = null
  override var isLoggedIn = false
  override var tags: Map<String, String> = emptyMap()
  override var pushSubscriptionId: String? = null
  override var pushSubscriptionToken: String? = null
  override var pushSubscriptionOptedIn = false
  override var permission = false
  override var logLevel = SallaPushLogLevel.WARN

  // Registered as native registers them: once per object, removed by equals.
  val clickListeners = mutableListOf<SallaPushClickListener>()
  val foregroundListeners = mutableListOf<SallaPushForegroundLifecycleListener>()
  val permissionObservers = mutableListOf<SallaPushPermissionObserver>()
  val userObservers = mutableListOf<SallaPushUserObserver>()
  val subscriptionObservers = mutableListOf<SallaPushSubscriptionObserver>()
  val removed = mutableListOf<Any>()
  val logListeners = LinkedHashMap<SallaPushLogListener, SallaPushLogLevel>()
  val displayed = mutableListOf<SallaPushNotification>()

  override fun initWithContext(context: Context, appId: String, config: SallaPushConfig) {
    calls += "initWithContext($appId)"
    initContexts += context
    initConfigs += config
  }

  override fun setConsentRequired(required: Boolean) {
    calls += "setConsentRequired($required)"
  }

  override fun setConsentGiven(given: Boolean) {
    calls += "setConsentGiven($given)"
  }

  override fun login(externalId: String, identityToken: String) {
    calls += "login($externalId, $identityToken)"
  }

  override fun logout() {
    calls += "logout()"
  }

  override fun addTag(key: String, value: String) {
    calls += "addTag($key, $value)"
  }

  override fun addTags(tags: Map<String, String>) {
    calls += "addTags"
    addedTags += tags
  }

  override fun removeTag(key: String) {
    calls += "removeTag($key)"
  }

  override fun removeTags(keys: Collection<String>) {
    calls += "removeTags"
    removedTags += keys
  }

  override fun setLanguage(language: String?) {
    calls += "setLanguage($language)"
  }

  override fun optIn() {
    calls += "optIn()"
  }

  override fun optOut() {
    calls += "optOut()"
  }

  override fun canRequestPermission() = canRequest

  override fun requestPermission(fallbackToSettings: Boolean, callback: (Boolean) -> Unit) {
    calls += "requestPermission($fallbackToSettings)"
    callback(permissionAnswer)
  }

  override fun refreshPermission() {
    calls += "refreshPermission()"
  }

  override fun clearAllNotifications() {
    calls += "clearAllNotifications()"
  }

  override fun removeNotification(androidNotificationId: Int) {
    calls += "removeNotification($androidNotificationId)"
  }

  override fun isSallaPushMessage(data: Map<String, String>): Boolean {
    checkedMessages += data
    return recognizesMessages
  }

  override fun trackOpened(additionalData: JSONObject?): Boolean {
    openedData += additionalData
    return tracksOpened
  }

  override fun setDisplayCompatPayloads(display: Boolean) {
    calls += "setDisplayCompatPayloads($display)"
  }

  override fun addClickListener(listener: SallaPushClickListener) = add("addClickListener", clickListeners, listener)

  override fun removeClickListener(listener: SallaPushClickListener) =
    remove("removeClickListener", clickListeners, listener)

  override fun addForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener) =
    add("addForegroundLifecycleListener", foregroundListeners, listener)

  override fun removeForegroundLifecycleListener(listener: SallaPushForegroundLifecycleListener) =
    remove("removeForegroundLifecycleListener", foregroundListeners, listener)

  override fun display(notification: SallaPushNotification) {
    displayed += notification
  }

  override fun addPermissionObserver(observer: SallaPushPermissionObserver) =
    add("addPermissionObserver", permissionObservers, observer)

  override fun removePermissionObserver(observer: SallaPushPermissionObserver) =
    remove("removePermissionObserver", permissionObservers, observer)

  override fun addUserObserver(observer: SallaPushUserObserver) = add("addUserObserver", userObservers, observer)

  override fun removeUserObserver(observer: SallaPushUserObserver) = remove("removeUserObserver", userObservers, observer)

  override fun addSubscriptionObserver(observer: SallaPushSubscriptionObserver) =
    add("addSubscriptionObserver", subscriptionObservers, observer)

  override fun removeSubscriptionObserver(observer: SallaPushSubscriptionObserver) =
    remove("removeSubscriptionObserver", subscriptionObservers, observer)

  override fun addLogListener(listener: SallaPushLogListener, level: SallaPushLogLevel) {
    calls += "addLogListener($level)"
    logListeners[listener] = level
  }

  override fun removeLogListener(listener: SallaPushLogListener) {
    calls += "removeLogListener"
    removed += listener
    logListeners.remove(listener)
  }

  private fun <T> add(call: String, registered: MutableList<T>, item: T) {
    calls += call
    if (item !in registered) registered += item
  }

  private fun <T : Any> remove(call: String, registered: MutableList<T>, item: T) {
    calls += call
    removed += item
    registered.remove(item)
  }
}
