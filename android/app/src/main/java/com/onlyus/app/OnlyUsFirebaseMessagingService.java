package com.onlyus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class OnlyUsFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "OnlyUsFCMService";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token received: " + token);

        try {
            SharedPreferences prefs = getSharedPreferences(OnlyUsConfig.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString("fcm_token", token).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to cache FCM token", e);
        }

        OnlyUsNotificationPlugin.notifyTokenRefreshed(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Context context = getApplicationContext();
        if (context == null) return;

        // Stealth notes edition has zero notifications
        if (context.getPackageName().contains("notes")) {
            return;
        }

        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String title = null;
        String body = null;
        String avatarUrl = null;
        String replyRole = "owner";
        int notificationId = (int) (System.currentTimeMillis() % 100000);

        if (data != null && !data.isEmpty()) {
            title = data.get("title");
            body = data.get("body");
            avatarUrl = data.get("avatarUrl");
            if (data.containsKey("replyRole") && data.get("replyRole") != null) {
                replyRole = data.get("replyRole");
            }
            if (data.containsKey("notificationId") && data.get("notificationId") != null) {
                try {
                    notificationId = Integer.parseInt(data.get("notificationId"));
                } catch (Exception ignored) {}
            }
        }

        if (title == null && remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
        }
        if (body == null && remoteMessage.getNotification() != null) {
            body = remoteMessage.getNotification().getBody();
        }

        if (title == null || title.trim().isEmpty()) {
            title = "Nusrat";
        }
        if (body == null || body.trim().isEmpty()) {
            body = "Sent you a message";
        }

        OnlyUsNotificationPlugin.showChatNotificationNative(
            context,
            title,
            body,
            notificationId,
            replyRole,
            avatarUrl
        );
    }
}
