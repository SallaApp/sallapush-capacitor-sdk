package sa.salla.sallapush.example;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import com.google.firebase.messaging.RemoteMessage;
import com.salla.push.SallaPush;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The example's test hook for the smoke tests; never part of the library or of an app. It hands the FCM data map in
 * the "payload" extra (a JSON object of strings, such as android/TestPayloads/native.json) to SallaPush on a background
 * thread, as FCM delivers a message. Only holders of android.permission.DUMP, such as the adb shell, can send it:
 *
 * adb shell am broadcast -n <application id>/sa.salla.sallapush.example.TestPushReceiver --es payload '<json>'
 */
public class TestPushReceiver extends BroadcastReceiver {

    private static final String PAYLOAD = "payload";
    private static final String TAG = "SallaPushExample";

    @Override
    public void onReceive(Context context, Intent intent) {
        Map<String, String> data = dataOf(intent.getStringExtra(PAYLOAD));
        if (data == null) {
            Log.w(TAG, "The \"" + PAYLOAD + "\" extra must be a JSON object of strings.");
            return;
        }
        Context appContext = context.getApplicationContext();
        PendingResult pending = goAsync();
        new Thread(() -> handOver(appContext, data, pending), "SallaPushExample-test-push").start();
    }

    private static void handOver(Context context, Map<String, String> data, PendingResult pending) {
        try {
            RemoteMessage message = new RemoteMessage.Builder("sallapush-example@fcm.googleapis.com").setData(data).build();
            boolean handled = SallaPush.getNotifications().handleFirebaseMessage(context, message);
            Log.i(TAG, handled ? "SallaPush handled the test push." : "The test push isn't SallaPush's.");
        } finally {
            pending.finish();
        }
    }

    private static Map<String, String> dataOf(String payload) {
        if (payload == null) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(payload);
            Map<String, String> data = new HashMap<>();
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                data.put(key, json.getString(key));
            }
            return data;
        } catch (JSONException e) {
            return null;
        }
    }
}
