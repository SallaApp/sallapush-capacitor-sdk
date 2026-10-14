package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushClickEvent
import com.salla.push.SallaPushLogLevel
import com.salla.push.SallaPushLoginFailure
import com.salla.push.SallaPushNotification
import com.salla.push.SallaPushPayloadSource
import com.salla.push.SallaPushSubscriptionChangedState
import com.salla.push.SallaPushSubscriptionState
import com.salla.push.SallaPushUserChangedState
import com.salla.push.SallaPushUserState
import java.math.BigDecimal
import java.math.BigInteger
import java.util.Locale

/**
 * Native values as the JavaScript events carry them: plain maps, which the plugin turns into JSObjects, with null
 * values left out and enums by case.
 */
internal object Mapping {

  fun click(event: SallaPushClickEvent): Map<String, Any?> = buildMap {
    put("notification", notification(event.notification))
    putIfNotNull("actionId", event.result.actionId)
    putIfNotNull("url", event.result.url)
  }

  /** The notification, with the results of native's typed accessors for each top-level additionalData key. */
  fun notification(notification: SallaPushNotification): Map<String, Any?> = buildMap {
    val keys = notification.additionalData.keys
    putIfNotNull("notificationId", notification.notificationId)
    putIfNotNull("title", notification.title)
    putIfNotNull("subtitle", notification.subtitle)
    putIfNotNull("body", notification.body)
    putIfNotNull("imageUrl", notification.imageUrl)
    putIfNotNull("launchUrl", notification.launchUrl)
    put("additionalData", jsonObject(notification.additionalData))
    put("rawPayload", notification.rawPayload)
    put("source", notification.source.jsName)
    put("stringValues", typedValues(keys, notification::getString))
    put("intValues", typedValues(keys, notification::getLong))
    put("boolValues", typedValues(keys, notification::getBoolean))
    put("numberValues", emptyMap<String, Any>())
    putIfNotNull("sound", notification.sound)
    put("androidNotificationId", notification.androidNotificationId)
    putIfNotNull("collapseId", notification.collapseId)
    putIfNotNull("channelId", notification.channelId)
  }

  fun permissionChange(permission: Boolean): Map<String, Any?> = mapOf("permission" to permission)

  fun userChange(state: SallaPushUserChangedState): Map<String, Any?> =
    mapOf("previous" to user(state.previous), "current" to user(state.current))

  fun loginFailure(failure: SallaPushLoginFailure): Map<String, Any?> = mapOf("failure" to failure.jsName)

  fun subscriptionChange(listenerId: Int, state: SallaPushSubscriptionChangedState): Map<String, Any?> =
    mapOf(
      "listenerId" to listenerId,
      "previous" to subscription(state.previous),
      "current" to subscription(state.current),
    )

  private fun user(state: SallaPushUserState): Map<String, Any?> = buildMap {
    putIfNotNull("externalId", state.externalId)
    put("isLoggedIn", state.isLoggedIn)
  }

  private fun subscription(state: SallaPushSubscriptionState): Map<String, Any?> = buildMap {
    putIfNotNull("id", state.id)
    putIfNotNull("token", state.token)
    put("optedIn", state.optedIn)
  }

  /** The non-null results of one accessor, by key. */
  private fun <T : Any> typedValues(keys: Set<String>, accessor: (String) -> T?): Map<String, T> =
    keys.mapNotNull { key -> accessor(key)?.let { key to it } }.toMap()

  private fun jsonObject(map: Map<*, *>): Map<String, Any?> =
    map.entries.associate { (key, value) -> key.toString() to jsonValue(value) }

  /** A JSON value the bridge carries: BigDecimal and BigInteger, which it can't, become their decimal text. */
  private fun jsonValue(value: Any?): Any? = when (value) {
    null, is String, is Boolean -> value
    is BigDecimal -> value.toPlainString()
    is BigInteger -> value.toString()
    is Number -> value
    is Map<*, *> -> jsonObject(value)
    is List<*> -> value.map(::jsonValue)
    else -> value.toString()
  }

  private fun MutableMap<String, Any?>.putIfNotNull(key: String, value: Any?) {
    if (value != null) put(key, value)
  }
}

/** The source as JavaScript names it. */
internal val SallaPushPayloadSource.jsName: String
  get() = when (this) {
    SallaPushPayloadSource.NATIVE -> "native"
    SallaPushPayloadSource.COMPAT -> "compat"
  }

/** The failure as JavaScript names it. */
internal val SallaPushLoginFailure.jsName: String
  get() = when (this) {
    SallaPushLoginFailure.TOKEN_REJECTED -> "tokenRejected"
    SallaPushLoginFailure.INVALID_REQUEST -> "invalidRequest"
  }

/** The level as JavaScript names it, such as "debug". */
internal val SallaPushLogLevel.jsName: String
  get() = name.lowercase(Locale.ROOT)

/** The native level that JavaScript names [name]; null for any other text. */
internal fun logLevelNamed(name: String): SallaPushLogLevel? =
  SallaPushLogLevel.entries.firstOrNull { it.jsName == name }
