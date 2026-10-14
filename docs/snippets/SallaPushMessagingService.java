package com.example.app;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.salla.push.SallaPush;

/** Hands SallaPush its own messages and tokens first; everything else goes to @capacitor/push-notifications. */
public class SallaPushMessagingService extends MessagingService {

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
