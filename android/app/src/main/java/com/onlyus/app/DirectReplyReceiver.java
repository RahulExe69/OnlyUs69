package com.onlyus.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class DirectReplyReceiver extends BroadcastReceiver {
    public static final String KEY_TEXT_REPLY = "key_text_reply";
    public static final String ACTION_DIRECT_REPLY = "com.onlyus.app.ACTION_DIRECT_REPLY";
    private static final String TAG = "DirectReplyReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) return;

        CharSequence replyText = remoteInput.getCharSequence(KEY_TEXT_REPLY);
        if (replyText == null || replyText.toString().trim().isEmpty()) return;

        final String text = replyText.toString().trim();
        final int notificationId = intent.getIntExtra("notification_id", 1001);
        final String replyRole = intent.getStringExtra("reply_role") != null ? intent.getStringExtra("reply_role") : "owner";
        final String senderName = intent.getStringExtra("sender_name") != null ? intent.getStringExtra("sender_name") : "Nusrat";

        // 1. Immediately acknowledge on the notification card without opening the app
        updateNotificationReplied(context, notificationId, senderName, text);

        // 2. Record reply timestamp in SharedPreferences to prevent duplicate triggers in SyncService
        try {
            SharedPreferences prefs = context.getSharedPreferences("onlyus_sync_prefs", Context.MODE_PRIVATE);
            prefs.edit().putLong("last_reply_sent_at", System.currentTimeMillis()).apply();
        } catch (Exception ignored) {}

        // 3. Notify active WebView if MainActivity is alive (so active chat updates instantly)
        MainActivity.notifyReplyReceivedInApp(text);

        // 4. Send directly to Supabase via background executor
        Executors.newSingleThreadExecutor().execute(() -> {
            boolean success = sendReplyToSupabase(text, replyRole);
            if (!success) {
                Log.e(TAG, "Direct reply failed to post to Supabase");
            } else {
                Log.d(TAG, "Direct reply successfully posted to Supabase as " + replyRole);
            }
        });
    }

    private void updateNotificationReplied(Context context, int notificationId, String senderName, String replyText) {
        try {
            NotificationCompat.BigTextStyle repliedStyle = new NotificationCompat.BigTextStyle()
                .setBigContentTitle(senderName)
                .bigText("Replied: " + replyText);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, OnlyUsConfig.NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_onlyus)
                .setContentTitle(senderName)
                .setContentText("Replied: " + replyText)
                .setStyle(repliedStyle)
                .setColor(0xFFE11D48)
                .setAutoCancel(true)
                .setTimeoutAfter(3000);

            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Failed to update notification: " + e.getMessage());
        }
    }

    private boolean sendReplyToSupabase(String text, String senderRole) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(OnlyUsConfig.SUPABASE_URL + "/rest/v1/messages");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "return=minimal");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String nowIso = sdf.format(new Date());

            // Schema-compliant payload exactly matching App.tsx insert fields
            JSONObject payload = new JSONObject();
            payload.put("sender_role", senderRole);
            payload.put("text", text);
            payload.put("created_at", nowIso);
            payload.put("reactions", new JSONObject());
            payload.put("reply_to", JSONObject.NULL);
            payload.put("attachment_url", JSONObject.NULL);

            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                // Instantly update user's last_read_at so Nusrat sees blue tick immediately!
                updateUserLastReadAt(senderRole, nowIso);
                return true;
            }

            // Log Supabase error stream if request failed
            try (InputStream es = conn.getErrorStream();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(es, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                Log.e(TAG, "Supabase reply failed with HTTP " + responseCode + ": " + sb.toString());
            } catch (Exception ignored) {}

            return false;
        } catch (Exception e) {
            Log.e(TAG, "Exception posting reply to Supabase: " + e.getMessage(), e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void updateUserLastReadAt(String role, String nowIso) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(OnlyUsConfig.SUPABASE_URL + "/rest/v1/users?role=eq." + role);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
            conn.setRequestProperty("apikey", OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "return=minimal");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            JSONObject payload = new JSONObject();
            payload.put("last_read_at", nowIso);
            payload.put("last_seen", nowIso);

            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
                os.flush();
            }

            int code = conn.getResponseCode();
            Log.d(TAG, "User " + role + " last_read_at updated with HTTP " + code);
        } catch (Exception e) {
            Log.w(TAG, "Failed to update last_read_at in users: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
