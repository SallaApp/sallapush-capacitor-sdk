package com.example.app;

import com.google.firebase.messaging.RemoteMessage;
import com.salla.push.SallaPush;

/** Hands SallaPush its own messages and tokens first, and every other one to the push plugin's service it extends. */
public class SallaPushMessagingService extends OtherPluginMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage message) {
        if (SallaPush.getNotifications().handleFirebaseMessage(getApplicationContext(), message)) {
            return;
        }
        super.onMessageReceived(message);
    }

    @Override
    public void onNewToken(String token) {
        SallaPush.getNotifications().onNewToken(getApplicationContext(), token);
        super.onNewToken(token);
    }
}
