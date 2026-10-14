package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushClickEvent
import com.salla.push.SallaPushClickListener
import com.salla.push.SallaPushForegroundLifecycleListener
import com.salla.push.SallaPushLoginFailure
import com.salla.push.SallaPushPermissionObserver
import com.salla.push.SallaPushSubscriptionChangedState
import com.salla.push.SallaPushSubscriptionObserver
import com.salla.push.SallaPushUserChangedState
import com.salla.push.SallaPushUserObserver
import com.salla.push.SallaPushWillDisplayEvent

/** The JavaScript events, by their Capacitor event names. */
internal enum class Event(val jsName: String) {
  CLICK("click"),
  WILL_DISPLAY("willDisplay"),
  PERMISSION_CHANGE("permissionChange"),
  USER_CHANGE("userChange"),
  LOGIN_FAILURE("loginFailure"),
  PUSH_SUBSCRIPTION_CHANGE("pushSubscriptionChange"),
}

/**
 * The native listeners behind the JavaScript ones: one per event kind while JavaScript listens to it, and one push
 * subscription observer per JavaScript listener, so each gets native's own replay. Main thread only: native calls back
 * there, and the plugin posts its calls there. Once [isActive] is false, as when the activity was destroyed, the
 * listeners leave everything to native.
 */
internal class EventRegistry(
  private val native: NativeSallaPush,
  private val displays: DisplayStore,
  private val isActive: () -> Boolean = { true },
  private val emit: (Event, Map<String, Any?>) -> Unit,
) {
  /** The event kinds with one native registration each, as JavaScript names them. */
  private enum class Kind(val jsName: String) {
    CLICK("click"),
    WILL_DISPLAY("willDisplay"),
    PERMISSION("permission"),
    USER("user"),
    LOGIN_FAILURE("loginFailure"),
  }

  /** The listener native holds, which its removal matches, and how to add and remove it. */
  private class Registration(val listener: Any, val add: () -> Unit, val remove: () -> Unit)

  private val registrations = mutableMapOf<Kind, Registration>()
  private val subscriptionObservers = mutableMapOf<Int, SallaPushSubscriptionObserver>()

  /** Registers the native listener of [kind], once; an unknown kind is ignored. */
  fun start(kind: String) {
    val known = kindNamed(kind) ?: return
    if (known in registrations) return
    when (known) {
      Kind.CLICK -> register(known, clickListener(), native::addClickListener, native::removeClickListener)
      Kind.WILL_DISPLAY -> register(
        known,
        foregroundListener(),
        native::addForegroundLifecycleListener,
        native::removeForegroundLifecycleListener,
      )
      Kind.PERMISSION ->
        register(known, permissionObserver(), native::addPermissionObserver, native::removePermissionObserver)
      Kind.USER -> register(known, userObserver(), native::addUserObserver, native::removeUserObserver)
      Kind.LOGIN_FAILURE ->
        register(known, loginFailureObserver(), native::addUserObserver, native::removeUserObserver)
    }
  }

  fun stop(kind: String) {
    val known = kindNamed(kind) ?: return
    registrations.remove(known)?.remove?.invoke()
  }

  /** Adds the native observer of one JavaScript listener, once; its events carry [listenerId]. */
  fun addSubscriptionListener(listenerId: Int) {
    if (listenerId in subscriptionObservers) return
    val observer = object : SallaPushSubscriptionObserver {
      override fun onPushSubscriptionChange(state: SallaPushSubscriptionChangedState) {
        if (isActive() && subscriptionObservers[listenerId] === this) {
          emit(Event.PUSH_SUBSCRIPTION_CHANGE, Mapping.subscriptionChange(listenerId, state))
        }
      }
    }
    subscriptionObservers[listenerId] = observer
    native.addSubscriptionObserver(observer)
  }

  fun removeSubscriptionListener(listenerId: Int) {
    subscriptionObservers.remove(listenerId)?.let(native::removeSubscriptionObserver)
  }

  /** Removes every native registration, as when the WebView loads a page. */
  fun stopAll() {
    val removed = registrations.values.toList()
    val observers = subscriptionObservers.values.toList()
    registrations.clear()
    subscriptionObservers.clear()
    removed.forEach { it.remove() }
    observers.forEach(native::removeSubscriptionObserver)
  }

  private fun <T : Any> register(kind: Kind, listener: T, add: (T) -> Unit, remove: (T) -> Unit) {
    val registration = Registration(listener, { add(listener) }, { remove(listener) })
    registrations[kind] = registration
    registration.add()
  }

  // Native can still deliver an event it took before the stop, or before the activity's destruction reached the main
  // thread, so each listener emits only while it is registered and the registry is active.
  private fun isRegistered(kind: Kind, listener: Any) = isActive() && registrations[kind]?.listener === listener

  private fun clickListener() = object : SallaPushClickListener {
    override fun onClick(event: SallaPushClickEvent) {
      if (isRegistered(Kind.CLICK, this)) emit(Event.CLICK, Mapping.click(event))
    }
  }

  // Native decides when its listeners return, so the notification is prevented now and held for JavaScript, which
  // shows it or keeps it hidden through its handle.
  private fun foregroundListener() = object : SallaPushForegroundLifecycleListener {
    override fun onWillDisplay(event: SallaPushWillDisplayEvent) {
      if (!isRegistered(Kind.WILL_DISPLAY, this)) return
      event.preventDefault()
      val handle = displays.put(event.notification)
      emit(Event.WILL_DISPLAY, Mapping.willDisplay(handle, event.notification))
    }
  }

  private fun permissionObserver() = object : SallaPushPermissionObserver {
    override fun onNotificationPermissionChange(permission: Boolean) {
      if (isRegistered(Kind.PERMISSION, this)) emit(Event.PERMISSION_CHANGE, Mapping.permissionChange(permission))
    }
  }

  private fun userObserver() = object : SallaPushUserObserver {
    override fun onUserStateChange(state: SallaPushUserChangedState) {
      if (isRegistered(Kind.USER, this)) emit(Event.USER_CHANGE, Mapping.userChange(state))
    }
  }

  // A second user observer, which native calls for login failures only.
  private fun loginFailureObserver() = object : SallaPushUserObserver {
    override fun onUserStateChange(state: SallaPushUserChangedState) = Unit

    override fun onLoginFailure(failure: SallaPushLoginFailure) {
      if (isRegistered(Kind.LOGIN_FAILURE, this)) emit(Event.LOGIN_FAILURE, Mapping.loginFailure(failure))
    }
  }

  private fun kindNamed(name: String): Kind? = Kind.entries.firstOrNull { it.jsName == name }
}
