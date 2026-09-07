package com.onlyus.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class OnlyUsSyncService extends Service {
    private static final String TAG = "OnlyUsSyncService";
    private static final String PREFS_NAME = "onlyus_sync_prefs";
    private static final String KEY_LAST_MESSAGE_ID = "last_seen_partner_message_id";
    private static final String KEY_CACHED_AVATAR_URL = "cached_partner_avatar_url";

    private ScheduledExecutorService scheduler;
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        // Stealth Notes flavor must NEVER run any background service
        if (getPackageName().contains("notes")) {
            stopSelf();
            return;
        }

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        scheduler = Executors.newSingleThreadScheduledExecutor();

        // Start background polling every 7 seconds
        scheduler.scheduleWithFixedDelay(this::pollForNewMessages, 2, 7, TimeUnit.SECONDS);
        Log.d(TAG, "OnlyUs background message sync service started");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (getPackageName().contains("notes")) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void pollForNewMessages() {
        try {
            // If app is currently open and visible in foreground, chat view handles live events
            if (MainActivity.isAppInForeground()) {
                return;
            }

            // 1. Fetch latest message from partner (Nusrat)
            String endpoint = OnlyUsConfig.SUPABASE_URL + "/rest/v1/messages" +
                "?select=id,sender_role,text,created_at,media,deleted" +
                "&sender_role=eq.partner" +
                "&deleted=eq.false" +
                "&order=created_at.desc" +
                "&limit=1";

            URL url = new URL(endpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            if (conn.getResponseCode() != 200) {
                conn.disconnect();
                return;
            }

            StringBuilder sb = new StringBuilder();
            try (InputStream is = conn.getInputStream();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
            conn.disconnect();

            JSONArray array = new JSONArray(sb.toString());
            if (array.length() == 0) return;

            JSONObject latest = array.getJSONObject(0);
            String messageId = latest.optString("id");
            if (messageId.isEmpty()) return;

            String lastSeenId = prefs.getString(KEY_LAST_MESSAGE_ID, null);

            // On first startup, record baseline so we don't spam notifications for old history
            if (lastSeenId == null) {
                prefs.edit().putString(KEY_LAST_MESSAGE_ID, messageId).apply();
                return;
            }

            // New message arrived from Nusrat!
            if (!messageId.equals(lastSeenId)) {
                String text = latest.optString("text", "").trim();
                JSONObject media = latest.optJSONObject("media");

                String body = text;
                if (body.isEmpty() && media != null) {
                    String mediaType = media.optString("type", "");
                    if ("voice".equalsIgnoreCase(mediaType) || "audio".equalsIgnoreCase(mediaType)) {
                        body = "🎤 Voice note";
                    } else if ("image".equalsIgnoreCase(mediaType) || "photo".equalsIgnoreCase(mediaType)) {
                        body = "📷 Photo";
                    } else if ("video".equalsIgnoreCase(mediaType)) {
                        body = "📹 Video";
                    } else {
                        body = "Sent an attachment";
                    }
                }

                if (body.isEmpty()) {
                    body = "Sent you a message";
                }

                // Resolve Nusrat's latest profile picture URL
                String avatarUrl = resolvePartnerAvatarUrl();

                int notifId = (int) (System.currentTimeMillis() % 100000);
                OnlyUsNotificationPlugin.showChatNotificationNative(
                    this,
                    "Nusrat",
                    body,
                    notifId,
                    "owner",
                    avatarUrl
                );

                // Update last seen message ID
                prefs.edit().putString(KEY_LAST_MESSAGE_ID, messageId).apply();
                Log.d(TAG, "Notification delivered for new message: " + messageId);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error polling Supabase: " + e.getMessage());
        }
    }

    private String resolvePartnerAvatarUrl() {
        String cached = prefs.getString(KEY_CACHED_AVATAR_URL, null);
        try {
            URL url = new URL(OnlyUsConfig.SUPABASE_URL + "/rest/v1/users?role=eq.partner&photo_url=not.is.null&photo_url=neq.&order=last_seen.desc&select=photo_url,username,display_name&limit=1");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + OnlyUsConfig.SUPABASE_ANON_KEY);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            if (conn.getResponseCode() == 200) {
                StringBuilder sb = new StringBuilder();
                try (InputStream is = conn.getInputStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                }
                conn.disconnect();

                JSONArray array = new JSONArray(sb.toString());
                if (array.length() > 0) {
                    JSONObject user = array.getJSONObject(0);
                    String photoUrl = user.optString("photo_url", "");
                    if (!photoUrl.isEmpty()) {
                        prefs.edit().putString(KEY_CACHED_AVATAR_URL, photoUrl).apply();
                        return photoUrl;
                    }
                }
            } else {
                conn.disconnect();
            }
        } catch (Exception ignored) {}
        return cached;
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }

        // Restart service via AlarmManager if system killed it on Rahul's app
        if (!getPackageName().contains("notes")) {
            try {
                Intent restartIntent = new Intent(getApplicationContext(), OnlyUsSyncService.class);
                PendingIntent pi = PendingIntent.getService(
                    getApplicationContext(),
                    101,
                    restartIntent,
                    PendingIntent.FLAG_ONE_SHOT | (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
                    am.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 3000, pi);
                }
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
