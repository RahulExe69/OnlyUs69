package com.onlyus.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OnlyUsNotification")
public class OnlyUsNotificationPlugin extends Plugin {
    private static final String TAG = "OnlyUsNotification";

    @PluginMethod
    public void showChatNotification(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        // Stealth edition has zero notifications
        if (context.getPackageName().contains("notes")) {
            call.resolve();
            return;
        }

        String title = call.getString("title", "Nusrat");
        String body = call.getString("body", "Sent you a message");
        String senderRole = call.getString("senderRole", "owner");
        int notificationId = call.getInt("notificationId", (int) (System.currentTimeMillis() % 100000));

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

        // 2. Direct Reply Action with RemoteInput (Tapping send fires broadcast WITHOUT opening app!)
        RemoteInput remoteInput = new RemoteInput.Builder(DirectReplyReceiver.KEY_TEXT_REPLY)
            .setLabel("Reply to " + title + "...")
            .build();

        Intent replyIntent = new Intent(context, DirectReplyReceiver.class);
        replyIntent.setAction(DirectReplyReceiver.ACTION_DIRECT_REPLY);
        replyIntent.putExtra("notification_id", notificationId);
        replyIntent.putExtra("sender_role", senderRole);
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

        // 3. Open Action Button
        NotificationCompat.Action openAction = new NotificationCompat.Action.Builder(
            R.drawable.ic_launcher,
            "Open",
            openPendingIntent
        ).build();

        // 4. Large Icon: Nusrat's Profile Avatar
        Bitmap largeAvatar = null;
        try {
            largeAvatar = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_nusrat_avatar);
        } catch (Exception e) {
            Log.w(TAG, "Could not decode avatar drawable: " + e.getMessage());
        }

        // 5. Build Notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, OnlyUsConfig.NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_onlyus)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(0xFFE11D48)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .addAction(replyAction)
            .addAction(openAction);

        if (largeAvatar != null) {
            builder.setLargeIcon(largeAvatar);
        }

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
            call.resolve();
        } catch (SecurityException se) {
            Log.e(TAG, "Missing notification permission: " + se.getMessage());
            call.reject("Missing notification permission", se);
        } catch (Exception e) {
            Log.e(TAG, "Error posting notification: " + e.getMessage());
            call.reject("Failed to show notification", e);
        }
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

    private void createNotificationChannel(Context context) {
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
