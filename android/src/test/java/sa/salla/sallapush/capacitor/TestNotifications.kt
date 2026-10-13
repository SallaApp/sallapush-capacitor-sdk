package sa.salla.sallapush.capacitor

import com.salla.push.SallaPushNotification
import com.salla.push.SallaPushPayloadSource

/** A native notification for the tests, by default the native test payload as SallaPush parses it. */
internal fun testNotification(
  additionalData: Map<String, Any?> = mapOf("type" to "product", "id" to "42"),
  source: SallaPushPayloadSource = SallaPushPayloadSource.NATIVE,
  notificationId: String? = "msg_5a11a90001",
  title: String? = "SallaPush test",
  subtitle: String? = null,
  body: String? = "A native SallaPush notification",
  imageUrl: String? = null,
  launchUrl: String? = "https://example.com/products/42",
  collapseId: String? = null,
  channelId: String? = null,
  sound: String? = null,
  rawPayload: Map<String, String> = mapOf("sp_v" to "1", "sp_id" to "msg_5a11a90001", "type" to "product", "id" to "42"),
): SallaPushNotification = NativeValues.notification(
  notificationId,
  1_786_134_917,
  title,
  subtitle,
  body,
  imageUrl,
  launchUrl,
  additionalData,
  collapseId,
  channelId,
  sound,
  source,
  rawPayload,
)
