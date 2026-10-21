package com.onlyus.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OnlyUsNotification")
public class OnlyUsNotificationPlugin extends Plugin {
    private static final String TAG = "OnlyUsNotification";
    private static Bitmap sCachedAvatarBitmap = null;
    private static OnlyUsNotificationPlugin sInstance = null;

    @Override
    public void load() {
        super.load();
        sInstance = this;
    }

    public static void notifyTokenRefreshed(String token) {
        if (sInstance != null && token != null) {
            JSObject data = new JSObject();
            data.put("token", token);
            sInstance.notifyListeners("fcmTokenRefresh", data);
        }
    }

    @PluginMethod
    public void getFcmToken(PluginCall call) {
        Context context = getContext();
        if (context == null || context.getPackageName().contains("notes")) {
            JSObject ret = new JSObject();
            ret.put("token", "");
            call.resolve(ret);
            return;
        }

        try {
            FirebaseMessaging.getInstance().getToken()
                .addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                        JSObject ret = new JSObject();
                        ret.put("token", "");
                        call.resolve(ret);
                        return;
                    }
                    String token = task.getResult();
                    Log.d(TAG, "FCM token retrieved: " + token);
                    JSObject ret = new JSObject();
                    ret.put("token", token != null ? token : "");
                    call.resolve(ret);
                });
        } catch (Exception e) {
            Log.e(TAG, "Error fetching FCM token: " + e.getMessage(), e);
            JSObject ret = new JSObject();
            ret.put("token", "");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void showChatNotification(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        // Stealth notes edition has zero notifications
        if (context.getPackageName().contains("notes")) {
            call.resolve();
            return;
        }

        final String title = call.getString("title", "Nusrat");
        final String body = call.getString("body", "Sent you a message");
        final String replyRole = call.getString("replyRole", "owner");
        final String avatarUrl = call.getString("avatarUrl", null);
        final int notificationId = call.getInt("notificationId", (int) (System.currentTimeMillis() % 100000));

        // Execute in background thread to allow downloading / decoding avatar without blocking UI
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                showChatNotificationNative(context, title, body, notificationId, replyRole, avatarUrl);
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Failed to post chat notification: " + e.getMessage(), e);
                call.reject("Failed to show notification", e);
            }
        });
    }

    @PluginMethod
    public void cachePartnerAvatar(PluginCall call) {
        String avatarUrl = call.getString("avatarUrl");
        Context context = getContext();
        if (avatarUrl != null && !avatarUrl.trim().isEmpty() && context != null) {
            final String urlToCache = avatarUrl.trim();
            Executors.newSingleThreadExecutor().execute(() -> {
                resolveCircularAvatar(context, urlToCache);
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void cacheSharedSecret(PluginCall call) {
        String sharedKeyBase64 = call.getString("sharedKeyBase64");
        Context context = getContext();
        if (context != null && sharedKeyBase64 != null && !sharedKeyBase64.trim().isEmpty()) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(OnlyUsConfig.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString("e2ee_shared_key_base64", sharedKeyBase64.trim()).apply();
                Log.d(TAG, "E2EE shared secret cached in native SharedPreferences");
            } catch (Exception e) {
                Log.e(TAG, "Failed to cache E2EE shared secret", e);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void cancelChatNotification(PluginCall call) {
        Context context = getContext();
        if (context != null) {
            int notificationId = call.getInt("notificationId", -1);
            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            } else {
                NotificationManagerCompat.from(context).cancelAll();
            }
        }
        call.resolve();
    }

    /**
     * Native notification dispatcher callable from both the JS plugin bridge and background SyncService.
     */
    public static void showChatNotificationNative(
        Context context,
        String title,
        String body,
        int notificationId,
        String replyRole,
        String avatarUrl
    ) {
        if (context == null || context.getPackageName().contains("notes")) {
            return;
        }

        createNotificationChannel(context);

        // 1. Content Intent: Tapping notification body opens MainActivity
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setAction(Intent.ACTION_MAIN);
        openIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        int activityFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            activityFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            activityFlags
        );

        // 2. Direct Reply Action with RemoteInput (tapping Send fires broadcast WITHOUT opening app!)
        RemoteInput remoteInput = new RemoteInput.Builder(DirectReplyReceiver.KEY_TEXT_REPLY)
            .setLabel("Reply to " + title + "...")
            .build();

        Intent replyIntent = new Intent(context, DirectReplyReceiver.class);
        replyIntent.setAction(DirectReplyReceiver.ACTION_DIRECT_REPLY);
        replyIntent.setPackage(context.getPackageName());
        replyIntent.putExtra("notification_id", notificationId);
        replyIntent.putExtra("reply_role", replyRole != null && !replyRole.isEmpty() ? replyRole : "owner");
        replyIntent.putExtra("sender_name", title);

        int broadcastFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            broadcastFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId,
            replyIntent,
            broadcastFlags
        );

        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
            R.drawable.ic_stat_onlyus,
            "Reply",
            replyPendingIntent
        )
        .addRemoteInput(remoteInput)
        .setAllowGeneratedReplies(true)
        .build();

        // 3. Large Icon: Nusrat's Actual Profile Picture (circular cropped)
        Bitmap largeAvatar = resolveCircularAvatar(context, avatarUrl);

        // Keep one stable notification for this one-to-one chat and render it
        // with Android's native MessagingStyle rather than a plain BigText notification.
        final int conversationNotificationId = 69001;
        final String historyKey = "chat_notification_history_" + context.getPackageName();
        final SharedPreferences notificationPrefs = context.getSharedPreferences("onlyus_notification_state", Context.MODE_PRIVATE);
        org.json.JSONArray history = new org.json.JSONArray();
        try {
            org.json.JSONArray saved = new org.json.JSONArray(notificationPrefs.getString(historyKey, "[]"));
            int start = Math.max(0, saved.length() - 7);
            for (int i = start; i < saved.length(); i++) {
                org.json.JSONObject item = saved.optJSONObject(i);
                if (item != null) history.put(item);
            }
        } catch (Exception ignored) {}

        try {
            org.json.JSONObject latest = new org.json.JSONObject();
            latest.put("title", title);
            latest.put("body", body);
            latest.put("time", System.currentTimeMillis());
            history.put(latest);
            notificationPrefs.edit().putString(historyKey, history.toString()).apply();
        } catch (Exception ignored) {}

        androidx.core.app.Person me = new androidx.core.app.Person.Builder()
            .setName("You")
            .build();
        NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(me)
            .setConversationTitle(title)
            .setGroupConversation(false);

        for (int i = 0; i < history.length(); i++) {
            org.json.JSONObject item = history.optJSONObject(i);
            if (item == null) continue;
            String messageBody = item.optString("body", "");
            long messageTime = item.optLong("time", System.currentTimeMillis());
            String messageTitle = item.optString("title", title);
            androidx.core.app.Person messageSender = new androidx.core.app.Person.Builder()
                .setName(messageTitle)
                .setIcon(largeAvatar != null ? androidx.core.graphics.drawable.IconCompat.createWithBitmap(largeAvatar) : null)
                .build();
            messagingStyle.addMessage(messageBody, messageTime, messageSender);
        }

        // Android supplies the conversation layout, individual message rows, and expansion.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, OnlyUsConfig.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_onlyus)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(messagingStyle)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(0xFFE11D48)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setGroup("onlyus_chat_conversation")
            .addAction(replyAction);

        if (largeAvatar != null) {
            builder.setLargeIcon(largeAvatar);
        }

        try {
            NotificationManagerCompat.from(context).notify(conversationNotificationId, builder.build());
        } catch (SecurityException se) {
            Log.e(TAG, "Missing POST_NOTIFICATIONS permission: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error posting notification: " + e.getMessage(), e);
        }
    }

    /**
     * Downloads/decodes partner photo and crops into a crisp, circular WhatsApp-style avatar.
     */
    public static Bitmap resolveCircularAvatar(Context context, String avatarUrl) {
        Bitmap rawBitmap = null;

        // 1. Try decoding from provided URL or base64 string
        if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
            String trimmed = avatarUrl.trim();
            if (trimmed.startsWith("data:image")) {
                try {
                    int comma = trimmed.indexOf(',');
                    String b64 = comma != -1 ? trimmed.substring(comma + 1) : trimmed;
                    byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                    rawBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to decode base64 avatar: " + e.getMessage());
                }
            } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                try {
                    URL url = new URL(trimmed);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(4000);
                    conn.setReadTimeout(4000);
                    conn.setDoInput(true);
                    conn.connect();
                    if (conn.getResponseCode() == 200) {
                        try (InputStream is = conn.getInputStream()) {
                            rawBitmap = BitmapFactory.decodeStream(is);
                        }
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to fetch avatar over HTTP: " + e.getMessage());
                }
            }

            // Save decoded raw bitmap to disk cache for offline / background access
            if (rawBitmap != null && context != null) {
                try {
                    File cacheFile = new File(context.getFilesDir(), "nusrat_avatar_cached.png");
                    try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                        rawBitmap.compress(Bitmap.CompressFormat.PNG, 90, fos);
                    }
                } catch (Exception ignored) {}
            }
        }

        // 2. Fallback to disk cache if download failed or avatarUrl was null
        if (rawBitmap == null && context != null) {
            try {
                File cacheFile = new File(context.getFilesDir(), "nusrat_avatar_cached.png");
                if (cacheFile.exists()) {
                    rawBitmap = BitmapFactory.decodeFile(cacheFile.getAbsolutePath());
                }
            } catch (Exception ignored) {}
        }

        // 3. Fallback to bundled drawable avatar
        if (rawBitmap == null && context != null) {
            try {
                rawBitmap = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_nusrat_avatar);
            } catch (Exception ignored) {}
        }

        if (rawBitmap == null) return null;

        return getCircularBitmap(rawBitmap);
    }

    /**
     * Crops any bitmap into an anti-aliased circle for notifications.
     */
    public static Bitmap getCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) return null;
        try {
            int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);

            final Paint paint = new Paint();
            final Rect srcRect = new Rect(
                (bitmap.getWidth() - size) / 2,
                (bitmap.getHeight() - size) / 2,
                (bitmap.getWidth() + size) / 2,
                (bitmap.getHeight() + size) / 2
            );
            final Rect destRect = new Rect(0, 0, size, size);

            paint.setAntiAlias(true);
            paint.setFilterBitmap(true);
            canvas.drawARGB(0, 0, 0, 0);
            canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);

            paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
            canvas.drawBitmap(bitmap, srcRect, destRect, paint);

            return output;
        } catch (Exception e) {
            return bitmap;
        }
    }

    private static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                NotificationChannel existing = manager.getNotificationChannel(OnlyUsConfig.NOTIFICATION_CHANNEL_ID);
                if (existing == null) {
                    NotificationChannel channel = new NotificationChannel(
                        OnlyUsConfig.NOTIFICATION_CHANNEL_ID,
                        OnlyUsConfig.NOTIFICATION_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("New incoming messages from Nusrat");
                    channel.enableVibration(true);
                    channel.enableLights(true);
                    channel.setLightColor(0xFFE11D48);

                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    channel.setSound(soundUri, attributes);

                    manager.createNotificationChannel(channel);
                }
            }
        }
    }
}
