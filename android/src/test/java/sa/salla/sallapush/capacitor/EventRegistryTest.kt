package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushLogLevel
import com.salla.push.SallaPushLoginFailure
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class EventRegistryTest {
  private val native = FakeNativeSallaPush()
  private val emitted = mutableListOf<Pair<Event, Map<String, Any?>>>()
  private val displays = DisplayStore(native)
  private val main = mutableListOf<() -> Unit>()
  private var active = true
  private val registry =
    EventRegistry(native, displays, { main += it }, { active }) { event, body -> emitted += event to body }

  @Test
  fun startsOneNativeRegistrationPerKindOnce() {
    listOf("click", "permission", "user", "loginFailure").forEach {
      registry.start(it)
      registry.start(it)
    }

    assertEquals(listOf("addClickListener", "addPermissionObserver", "addUserObserver", "addUserObserver"), native.calls)
    assertEquals(1, native.clickListeners.size)
    assertEquals(1, native.permissionObservers.size)
    assertEquals(2, native.userObservers.size)
  }

  @Test
  fun stopRemovesTheSameObjectItsStartAdded() {
    registry.start("click")
    registry.start("user")
    registry.start("loginFailure")
    val click = native.clickListeners.single()
    val (user, loginFailure) = native.userObservers

    registry.stop("loginFailure")
    registry.stop("click")
    registry.stop("click")
    registry.stop("permission")

    assertEquals(2, native.removed.size)
    assertSame(loginFailure, native.removed[0])
    assertSame(click, native.removed[1])
    assertSame(user, native.userObservers.single())
  }

  @Test
  fun startsAgainAfterAStop() {
    registry.start("permission")
    registry.stop("permission")
    registry.start("permission")

    assertEquals(listOf("addPermissionObserver", "removePermissionObserver", "addPermissionObserver"), native.calls)
    assertEquals(1, native.permissionObservers.size)
  }

  @Test
  fun ignoresUnknownKinds() {
    registry.start("opened")
    registry.start("Click")
    registry.stop("opened")

    assertTrue(native.calls.isEmpty())
  }

  @Test
  fun addsOneSubscriptionObserverPerListenerAndRemovesOnlyItsOwn() {
    registry.addSubscriptionListener(1)
    registry.addSubscriptionListener(1)
    registry.addSubscriptionListener(2)
    val (first, second) = native.subscriptionObservers

    registry.removeSubscriptionListener(1)
    registry.removeSubscriptionListener(1)
    registry.removeSubscriptionListener(3)

    assertEquals(listOf("addSubscriptionObserver", "addSubscriptionObserver", "removeSubscriptionObserver"), native.calls)
    assertSame(first, native.removed.single())
    assertSame(second, native.subscriptionObservers.single())
  }

  @Test
  fun stopAllRemovesEveryRegistration() {
    listOf("click", "permission", "user", "loginFailure").forEach(registry::start)
    registry.addSubscriptionListener(1)
    registry.addSubscriptionListener(2)

    registry.stopAll()

    assertEquals(6, native.removed.size)
    assertTrue(native.clickListeners.isEmpty())
    assertTrue(native.permissionObservers.isEmpty())
    assertTrue(native.userObservers.isEmpty())
    assertTrue(native.subscriptionObservers.isEmpty())
    registry.start("click")
    assertEquals(1, native.clickListeners.size)
  }

  @Test
  fun emitsClicksWithTheirNotification() {
    registry.start("click")
    val event = NativeValues.click(testNotification(), null, "https://example.com/products/42")

    native.clickListeners.single().onClick(event)

    assertEquals(listOf(Event.CLICK to Mapping.click(event)), emitted)
  }

  @Test
  fun preventsHoldsAndEmitsEachForegroundNotification() {
    registry.start("willDisplay")
    registry.start("willDisplay")
    val notification = testNotification()
    val event = NativeValues.willDisplay(notification)

    native.foregroundListeners.single().onWillDisplay(event)

    assertTrue(event.isPrevented)
    val (name, body) = emitted.single()
    assertEquals(Event.WILL_DISPLAY, name)
    assertEquals(Mapping.notification(notification), body["notification"])
    val handle = body["handle"] as String
    assertNotNull(java.util.UUID.fromString(handle))
    assertTrue(native.displayed.isEmpty())
    assertTrue(displays.display(handle))
    assertSame(notification, native.displayed.single())
  }

  @Test
  fun leavesAForegroundNotificationToNativeOnceStopped() {
    registry.start("willDisplay")
    val listener = native.foregroundListeners.single()
    registry.stop("willDisplay")
    val event = NativeValues.willDisplay(testNotification())

    listener.onWillDisplay(event)

    assertFalse(event.isPrevented)
    assertTrue(emitted.isEmpty())
    assertSame(listener, native.removed.single())
  }

  @Test
  fun emitsPermissionChanges() {
    registry.start("permission")

    native.permissionObservers.single().onNotificationPermissionChange(true)
    native.permissionObservers.single().onNotificationPermissionChange(false)

    assertEquals(
      listOf(
        Event.PERMISSION_CHANGE to mapOf("permission" to true),
        Event.PERMISSION_CHANGE to mapOf("permission" to false),
      ),
      emitted
    )
  }

  @Test
  fun emitsUserChangesAndLoginFailuresEachFromItsOwnObserver() {
    registry.start("user")
    registry.start("loginFailure")
    val (user, loginFailure) = native.userObservers
    val change = NativeValues.userChange(NativeValues.user(null, false), NativeValues.user("customer-7", true))

    user.onUserStateChange(change)
    user.onLoginFailure(SallaPushLoginFailure.TOKEN_REJECTED)
    loginFailure.onUserStateChange(change)
    loginFailure.onLoginFailure(SallaPushLoginFailure.TOKEN_REJECTED)
    loginFailure.onLoginFailure(SallaPushLoginFailure.INVALID_REQUEST)

    assertEquals(
      listOf(
        Event.USER_CHANGE to Mapping.userChange(change),
        Event.LOGIN_FAILURE to mapOf("failure" to "tokenRejected"),
        Event.LOGIN_FAILURE to mapOf("failure" to "invalidRequest"),
      ),
      emitted
    )
  }

  @Test
  fun addsTheLogListenerOnceAtWarnByDefault() {
    registry.start("log")
    registry.start("log")

    assertEquals(listOf("addLogListener(WARN)"), native.calls)
  }

  @Test
  fun addsTheLogListenerAtTheLevelJavaScriptSetFirst() {
    registry.setLogLevel(SallaPushLogLevel.INFO)
    registry.start("log")

    assertEquals(listOf("addLogListener(INFO)"), native.calls)
  }

  @Test
  fun aLevelChangeAddsTheSameListenerAgainOnlyWhileRegistered() {
    registry.setLogLevel(SallaPushLogLevel.DEBUG)
    registry.start("log")
    val listener = native.logListeners.keys.single()
    registry.setLogLevel(SallaPushLogLevel.DEBUG)
    registry.setLogLevel(SallaPushLogLevel.VERBOSE)

    assertEquals(mapOf(listener to SallaPushLogLevel.VERBOSE), native.logListeners)
    registry.stop("log")
    registry.setLogLevel(SallaPushLogLevel.ERROR)

    assertEquals(
      listOf("addLogListener(DEBUG)", "addLogListener(VERBOSE)", "removeLogListener"),
      native.calls
    )
    assertSame(listener, native.removed.single())
  }

  @Test
  fun emitsLogEntriesOnTheMainThreadInOrder() {
    registry.start("log")
    val first = logEvent("register.retry")
    val second = logEvent("register.ok")

    native.logListeners.keys.single().onLogEvent(first)
    native.logListeners.keys.single().onLogEvent(second)
    assertTrue(emitted.isEmpty())
    main.forEach { it() }

    assertEquals(
      listOf(Event.LOG to Mapping.logEntry(first), Event.LOG to Mapping.logEntry(second)),
      emitted
    )
  }

  @Test
  fun emitsNothingForALogEntryPostedBeforeTheStop() {
    registry.start("log")
    native.logListeners.keys.single().onLogEvent(logEvent("register.retry"))

    registry.stop("log")
    main.forEach { it() }

    assertTrue(emitted.isEmpty())
  }

  @Test
  fun emitsEachSubscriptionChangeWithTheIdOfItsListener() {
    registry.addSubscriptionListener(1)
    registry.addSubscriptionListener(2)
    val state = NativeValues.subscription("3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", "fcm-token", true)
    val change = NativeValues.subscriptionChange(state, state)

    native.subscriptionObservers[1].onPushSubscriptionChange(change)

    assertEquals(listOf(Event.PUSH_SUBSCRIPTION_CHANGE to Mapping.subscriptionChange(2, change)), emitted)
  }

  @Test
  fun emitsNothingForAnEventNativeDeliversAfterTheStop() {
    registry.start("user")
    registry.start("loginFailure")
    registry.addSubscriptionListener(1)
    val (user, loginFailure) = native.userObservers
    val subscription = native.subscriptionObservers.single()

    registry.stopAll()
    user.onUserStateChange(NativeValues.userChange(NativeValues.user(null, false), NativeValues.user("customer-7", true)))
    loginFailure.onLoginFailure(SallaPushLoginFailure.TOKEN_REJECTED)
    val state = NativeValues.subscription(null, null, false)
    subscription.onPushSubscriptionChange(NativeValues.subscriptionChange(state, state))

    assertTrue(emitted.isEmpty())
  }

  // The plugin's activity is destroyed while native's callbacks are already queued on the main thread.
  @Test
  fun emitsNothingOnceInactiveEvenWhileRegistered() {
    listOf("click", "willDisplay", "permission", "user", "loginFailure", "log").forEach(registry::start)
    registry.addSubscriptionListener(1)
    val (user, loginFailure) = native.userObservers
    val state = NativeValues.subscription(null, null, false)
    val willDisplay = NativeValues.willDisplay(testNotification())

    active = false
    native.clickListeners.single().onClick(NativeValues.click(testNotification(), null, null))
    native.foregroundListeners.single().onWillDisplay(willDisplay)
    native.permissionObservers.single().onNotificationPermissionChange(true)
    user.onUserStateChange(NativeValues.userChange(NativeValues.user(null, false), NativeValues.user("customer-7", true)))
    loginFailure.onLoginFailure(SallaPushLoginFailure.INVALID_REQUEST)
    native.subscriptionObservers.single().onPushSubscriptionChange(NativeValues.subscriptionChange(state, state))
    native.logListeners.keys.single().onLogEvent(logEvent("register.retry"))
    main.forEach { it() }

    assertTrue(emitted.isEmpty())
    assertFalse(willDisplay.isPrevented)
  }

  @Test
  fun namesTheEventsAsCapacitorsEventNames() {
    assertEquals(
      listOf("click", "willDisplay", "permissionChange", "userChange", "loginFailure", "pushSubscriptionChange", "log"),
      Event.entries.map { it.jsName }
    )
  }

  private fun logEvent(code: String) = NativeValues.logEvent(
    SallaPushLogLevel.WARN,
    "registration",
    code,
    "Registration failed (HTTP 503); retrying in 30 s.",
    mapOf("http_status" to "503"),
    1_800_000_000_123L,
  )
}
