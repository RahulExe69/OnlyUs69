package com.onlyus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;

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

        // Don't post a system notification while OnlyUs is already open.
        // The Notes edition is guarded above and never enters this path.
        if (MainActivity.isAppInForeground()) {
            Log.d(TAG, "Suppressing push notification because OnlyUs is foregrounded");
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

            // End-to-End Encryption support: decrypt ciphertext in native background if present
            String isEncrypted = data.get("is_encrypted");
            String ciphertext = data.get("ciphertext");
            String iv = data.get("iv");

            if (("true".equalsIgnoreCase(isEncrypted) || "1".equals(isEncrypted)) && ciphertext != null && iv != null) {
                String decryptedPreview = decryptE2EEPayload(context, ciphertext, iv);
                if (decryptedPreview != null && !decryptedPreview.trim().isEmpty()) {
                    body = decryptedPreview;
                }
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

    /**
     * Decrypts AES-256-GCM encrypted payload using the cached shared secret key.
     * Matches the Web Crypto SubtleCrypto AES-GCM format used in e2ee.ts.
     */
    private String decryptE2EEPayload(Context context, String ciphertextBase64, String ivBase64) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(OnlyUsConfig.PREFS_NAME, Context.MODE_PRIVATE);
            String sharedKeyBase64 = prefs.getString("e2ee_shared_key_base64", null);
            if (sharedKeyBase64 == null || sharedKeyBase64.trim().isEmpty()) {
                Log.d(TAG, "No cached E2EE shared key in SharedPreferences");
                return null;
            }

            byte[] keyBytes = Base64.decode(sharedKeyBase64.trim(), Base64.DEFAULT);
            byte[] ivBytes = Base64.decode(ivBase64.trim(), Base64.DEFAULT);
            byte[] cipherBytes = Base64.decode(ciphertextBase64.trim(), Base64.DEFAULT);

            SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "AES");
            // Standard Web Crypto AES-GCM appends 128-bit (16 bytes) authentication tag to ciphertext
            GCMParameterSpec gcmSpec = new GCMParameterSpec(128, ivBytes);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec);

            byte[] decryptedBytes = cipher.doFinal(cipherBytes);
            String decryptedJson = new String(decryptedBytes, StandardCharsets.UTF_8);

            JSONObject obj = new JSONObject(decryptedJson);
            String text = obj.optString("text", "");
            String attachmentUrl = obj.optString("attachment_url", "");

            if (text != null && !text.trim().isEmpty()) {
                return text.trim();
            } else if (attachmentUrl != null && !attachmentUrl.trim().isEmpty()) {
                try {
                    JSONObject attachObj = new JSONObject(attachmentUrl);
                    String type = attachObj.optString("type", "");
                    if ("audio".equalsIgnoreCase(type)) return "🎤 Voice note";
                    if ("image".equalsIgnoreCase(type)) return "📷 Photo";
                    if ("video".equalsIgnoreCase(type)) return "🎥 Video";
                } catch (Exception ignored) {}
                return "📎 Media attachment";
            }
            return null;
        } catch (Exception e) {
            Log.w(TAG, "Failed to decrypt E2EE payload for notification: " + e.getMessage());
            return null;
        }
    }
}
