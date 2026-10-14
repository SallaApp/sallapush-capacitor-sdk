package sa.salla.sallapush.capacitor;

import com.salla.push.SallaPushClickEvent;
import com.salla.push.SallaPushClickResult;
import com.salla.push.SallaPushLogEvent;
import com.salla.push.SallaPushLogLevel;
import com.salla.push.SallaPushNotification;
import com.salla.push.SallaPushPayloadSource;
import com.salla.push.SallaPushSubscriptionChangedState;
import com.salla.push.SallaPushSubscriptionState;
import com.salla.push.SallaPushUserChangedState;
import com.salla.push.SallaPushUserState;
import com.salla.push.SallaPushWillDisplayEvent;
import java.util.Map;

/**
 * Native value objects for the tests. Their constructors are internal to Kotlin, which compiles them as public, so
 * Java can call them.
 */
final class NativeValues {
  private NativeValues() {}

  static SallaPushNotification notification(
      String notificationId,
      int androidNotificationId,
      String title,
      String subtitle,
      String body,
      String imageUrl,
      String launchUrl,
      Map<String, ?> additionalData,
      String collapseId,
      String channelId,
      String sound,
      SallaPushPayloadSource source,
      Map<String, String> rawPayload) {
    return new SallaPushNotification(
        notificationId,
        androidNotificationId,
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
        rawPayload);
  }

  static SallaPushClickEvent click(SallaPushNotification notification, String actionId, String url) {
    return new SallaPushClickEvent(notification, new SallaPushClickResult(actionId, url));
  }

  static SallaPushWillDisplayEvent willDisplay(SallaPushNotification notification) {
    return new SallaPushWillDisplayEvent(notification);
  }

  static SallaPushUserChangedState userChange(SallaPushUserState previous, SallaPushUserState current) {
    return new SallaPushUserChangedState(previous, current);
  }

  static SallaPushUserState user(String externalId, boolean isLoggedIn) {
    return new SallaPushUserState(externalId, isLoggedIn);
  }

  static SallaPushSubscriptionChangedState subscriptionChange(
      SallaPushSubscriptionState previous, SallaPushSubscriptionState current) {
    return new SallaPushSubscriptionChangedState(previous, current);
  }

  static SallaPushSubscriptionState subscription(String id, String token, boolean optedIn) {
    return new SallaPushSubscriptionState(id, token, optedIn);
  }

  static SallaPushLogEvent logEvent(
      SallaPushLogLevel level,
      String category,
      String code,
      String message,
      Map<String, String> metadata,
      long timestampMillis) {
    return new SallaPushLogEvent(level, category, code, message, metadata, timestampMillis);
  }
}
