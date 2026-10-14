package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushLogLevel
import com.salla.push.SallaPushLoginFailure
import com.salla.push.SallaPushPayloadSource
import java.math.BigDecimal
import java.math.BigInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MappingTest {

  @Test
  fun mapsEveryNotificationField() {
    val notification = testNotification(
      subtitle = "Today",
      imageUrl = "https://example.com/order.png",
      collapseId = "order-42",
      channelId = "orders",
      sound = "chime",
    )

    val body = Mapping.notification(notification)

    assertEquals("msg_5a11a90001", body["notificationId"])
    assertEquals("SallaPush test", body["title"])
    assertEquals("Today", body["subtitle"])
    assertEquals("A native SallaPush notification", body["body"])
    assertEquals("https://example.com/order.png", body["imageUrl"])
    assertEquals("https://example.com/products/42", body["launchUrl"])
    assertEquals(mapOf("type" to "product", "id" to "42"), body["additionalData"])
    assertEquals(notification.rawPayload, body["rawPayload"])
    assertEquals("native", body["source"])
    assertEquals("chime", body["sound"])
    assertEquals(1_786_134_917, body["androidNotificationId"])
    assertEquals("order-42", body["collapseId"])
    assertEquals("orders", body["channelId"])
    assertEquals(emptyMap<String, Any>(), body["numberValues"])
    assertBridgeable(body)
  }

  @Test
  fun leavesOutTheFieldsNativeLeftNull() {
    val body = Mapping.notification(testNotification(notificationId = null, title = null, body = null, launchUrl = null))

    for (key in listOf("notificationId", "title", "subtitle", "body", "imageUrl", "launchUrl", "sound", "collapseId")) {
      assertFalse(key, key in body)
    }
    assertFalse("channelId" in body)
    assertTrue("androidNotificationId" in body)
  }

  @Test
  fun theTypedValuesAreNativesAccessorResultsForEveryKey() {
    val native = testNotification(additionalData = mapOf("type" to "product", "id" to "42", "express" to "1", "price" to "9.5"))
    val compat = testNotification(
      source = SallaPushPayloadSource.COMPAT,
      additionalData = mapOf(
        "type" to "product",
        "id" to 42,
        "count" to 3L,
        "price" to 9.5,
        "express" to true,
        "total" to BigDecimal("12.50"),
        "none" to null,
        "tags" to listOf("a"),
      ),
    )

    for (notification in listOf(native, compat)) {
      val body = Mapping.notification(notification)
      val strings = body["stringValues"] as Map<*, *>
      val ints = body["intValues"] as Map<*, *>
      val bools = body["boolValues"] as Map<*, *>

      for (key in notification.additionalData.keys) {
        assertEquals(key, notification.getString(key), strings[key])
        assertEquals(key, notification.getLong(key), ints[key])
        assertEquals(key, notification.getBoolean(key), bools[key])
      }
      assertTrue((strings.keys + ints.keys + bools.keys).all { it in notification.additionalData.keys })
    }
  }

  @Test
  fun theTypedValuesOfStringAndJsonData() {
    val native = Mapping.notification(testNotification(additionalData = mapOf("id" to "42", "express" to "1")))
    val compat = Mapping.notification(
      testNotification(source = SallaPushPayloadSource.COMPAT, additionalData = mapOf("id" to 42, "express" to true))
    )

    assertEquals(mapOf("id" to "42", "express" to "1"), native["stringValues"])
    assertEquals(mapOf("id" to 42L, "express" to 1L), native["intValues"])
    assertEquals(mapOf("express" to true), native["boolValues"])
    assertEquals(mapOf("id" to "42", "express" to "true"), compat["stringValues"])
    assertEquals(mapOf("id" to 42L), compat["intValues"])
    assertEquals(mapOf("express" to true), compat["boolValues"])
  }

  @Test
  fun turnsBigNumbersIntoDecimalTextAndKeepsOtherJsonValues() {
    val body = Mapping.notification(
      testNotification(
        source = SallaPushPayloadSource.COMPAT,
        additionalData = mapOf(
          "price" to BigDecimal("12345678901234567890.50"),
          "serial" to BigInteger("123456789012345678901234567890"),
          "count" to 3L,
          "ratio" to 0.5,
          "flag" to false,
          "none" to null,
          "offer" to mapOf("total" to BigDecimal("1E+3"), "items" to listOf(BigInteger.TEN, "x", null)),
        ),
      )
    )

    assertEquals(
      mapOf(
        "price" to "12345678901234567890.50",
        "serial" to "123456789012345678901234567890",
        "count" to 3L,
        "ratio" to 0.5,
        "flag" to false,
        "none" to null,
        "offer" to mapOf("total" to "1000", "items" to listOf("10", "x", null)),
      ),
      body["additionalData"]
    )
    assertBridgeable(body)
  }

  @Test
  fun mapsClicksLeavingOutANullActionAndUrl() {
    val notification = testNotification()

    val tap = Mapping.click(NativeValues.click(notification, null, null))
    val action = Mapping.click(NativeValues.click(notification, "reply", "https://example.com/products/42"))

    assertEquals(mapOf("notification" to Mapping.notification(notification)), tap)
    assertEquals("reply", action["actionId"])
    assertEquals("https://example.com/products/42", action["url"])
    assertBridgeable(action)
  }

  @Test
  fun mapsPermissionUserAndSubscriptionChanges() {
    val user = NativeValues.userChange(NativeValues.user("customer-7", true), NativeValues.user(null, false))
    val subscription = NativeValues.subscriptionChange(
      NativeValues.subscription(null, null, false),
      NativeValues.subscription("3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", "fcm-token", true),
    )

    assertEquals(mapOf("permission" to true), Mapping.permissionChange(true))
    assertEquals(
      mapOf(
        "previous" to mapOf("externalId" to "customer-7", "isLoggedIn" to true),
        "current" to mapOf("isLoggedIn" to false),
      ),
      Mapping.userChange(user)
    )
    assertEquals(
      mapOf(
        "listenerId" to 4,
        "previous" to mapOf("optedIn" to false),
        "current" to mapOf("id" to "3f1c5a52-6a7e-4d1e-9a53-0c7b9e1d2f40", "token" to "fcm-token", "optedIn" to true),
      ),
      Mapping.subscriptionChange(4, subscription)
    )
  }

  @Test
  fun mapsLogEntries() {
    val event = NativeValues.logEvent(
      SallaPushLogLevel.ERROR,
      "identity",
      "identity.client_error",
      "The login was refused (HTTP 400, invalid_request).",
      mapOf("http_status" to "400", "error_code" to "invalid_request"),
      1_800_000_000_123L,
    )

    val body = Mapping.logEntry(event)

    assertEquals(
      mapOf(
        "level" to "error",
        "category" to "identity",
        "code" to "identity.client_error",
        "message" to "The login was refused (HTTP 400, invalid_request).",
        "metadata" to mapOf("http_status" to "400", "error_code" to "invalid_request"),
        "timestamp" to 1_800_000_000_123L,
      ),
      body
    )
    assertBridgeable(body)
  }

  @Test
  fun namesLogLevelsByCaseBothWays() {
    for (level in SallaPushLogLevel.entries) {
      assertEquals(level, logLevelNamed(level.jsName))
    }
    assertEquals(listOf("off", "error", "warn", "info", "debug", "verbose"), SallaPushLogLevel.entries.map { it.jsName })
    assertNull(logLevelNamed("Debug"))
  }

  @Test
  fun namesEnumsByCase() {
    assertEquals(mapOf("failure" to "tokenRejected"), Mapping.loginFailure(SallaPushLoginFailure.TOKEN_REJECTED))
    assertEquals(mapOf("failure" to "invalidRequest"), Mapping.loginFailure(SallaPushLoginFailure.INVALID_REQUEST))
    assertEquals("native", SallaPushPayloadSource.NATIVE.jsName)
    assertEquals("compat", SallaPushPayloadSource.COMPAT.jsName)
  }

  /** Every value is a JSON value, which Conversions.toJSObject hands to JavaScript as it is. */
  private fun assertBridgeable(value: Any?) {
    when (value) {
      null, is String, is Boolean, is Int, is Long, is Double -> Unit
      is Map<*, *> -> value.forEach { (key, entry) ->
        assertTrue(key is String)
        assertBridgeable(entry)
      }
      is List<*> -> value.forEach(::assertBridgeable)
      else -> fail("${value::class} can't be emitted")
    }
  }
}
