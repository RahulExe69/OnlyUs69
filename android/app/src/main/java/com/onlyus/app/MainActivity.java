package com.onlyus.app;

import android.Manifest;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity implements SensorEventListener {
    private static MainActivity instance;
    private final Handler otaHandler = new Handler(Looper.getMainLooper());
    private final Handler panicExitHandler = new Handler(Looper.getMainLooper());
    private static final long MEDIA_PICKER_EXIT_FALLBACK_MS = 15 * 60 * 1000L;
    private boolean otaCheckStarted = false;
    private boolean panicExitStarted = false;
    private BroadcastReceiver screenOffReceiver;
    private Runnable mediaPickerExitFallback;
    private static volatile boolean isAppForeground = false;
    private SensorManager sensorManager;
public static boolean isAppInForeground() {
        return isAppForeground;
    }
    private Sensor accelerometer;
    private float lastX, lastY, lastZ;
    private long lastUpdate = 0;
    private static final int SHAKE_THRESHOLD = 2200;
    private static final int PERMISSION_REQ_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OnlyUsNotificationPlugin.class);
        registerPlugin(OnlyUsUpdatePlugin.class);
        registerPlugin(OnlyUsThemePlugin.class);
        super.onCreate(savedInstanceState);
        instance = this;

        boolean isNotes = getPackageName().contains("notes");

        if (isNotes) {
            // These are defensive/stealth enhancements, not prerequisites for opening the chat.
            // Some OEM Android builds can reject sensor or dynamic-receiver registration at runtime;
            // never let an optional Notes-only feature prevent the activity from starting.
            try {
                // Prevent screenshots & hide preview in the recent-apps drawer.
                getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } catch (RuntimeException e) {
                Log.w("OnlyUsNotesStartup", "Could not enable secure-window flag", e);
            }

            try {
                // Register native accelerometer shake listener for instant panic exit.
                sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
                if (sensorManager != null) {
                    accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                    if (accelerometer != null) {
                        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
                    }
                }
            } catch (RuntimeException e) {
                // Chat startup can continue even if an OEM sensor service is unavailable.
                Log.w("OnlyUsNotesStartup", "Shake-to-exit sensor unavailable; continuing startup", e);
                sensorManager = null;
                accelerometer = null;
            }

            try {
                // Display-off remains a separate panic signal; onStop() also runs for media pickers.
                registerNotesScreenOffReceiver();
            } catch (RuntimeException e) {
                // Fallback: keep the disguise/chat usable rather than crashing on receiver registration.
                Log.w("OnlyUsNotesStartup", "Screen-off receiver unavailable; continuing startup", e);
                screenOffReceiver = null;
            }
        }

        // 3. Request app-specific permissions on initial launch
        requestAppPermissions(isNotes);

        // Initialize the self-hosted web-bundle updater for both editions.
        initializeOtaUpdater();
    }


    private boolean isNotesFlavor() {
        return getPackageName().contains("notes");
    }

    private void registerNotesScreenOffReceiver() {
        screenOffReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())
                        && isNotesFlavor()
                        && !OnlyUsUpdatePlugin.shouldKeepActivityAlive()) {
                    exitNotesApp();
                }
            }
        };
        ContextCompat.registerReceiver(
                this,
                screenOffReceiver,
                new IntentFilter(Intent.ACTION_SCREEN_OFF),
                ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    private void scheduleMediaPickerExitFallback() {
        cancelMediaPickerExitFallback();
        mediaPickerExitFallback = () -> {
            if (!isAppForeground
                    && !isFinishing()
                    && !isDestroyed()
                    && !OnlyUsUpdatePlugin.shouldKeepActivityAlive()) {
                // A picker that was abandoned via Home must not leave an unlocked Notes task behind forever.
                exitNotesApp();
            }
        };
        panicExitHandler.postDelayed(mediaPickerExitFallback, MEDIA_PICKER_EXIT_FALLBACK_MS);
    }

    private void cancelMediaPickerExitFallback() {
        if (mediaPickerExitFallback != null) {
            panicExitHandler.removeCallbacks(mediaPickerExitFallback);
            mediaPickerExitFallback = null;
        }
    }

    private void exitNotesApp() {
        if (!isNotesFlavor() || panicExitStarted) return;
        panicExitStarted = true;
        runOnUiThread(() -> {
            try {
                finishAndRemoveTask();
            } catch (Exception ignored) {}
            android.os.Process.killProcess(android.os.Process.myPid());
            System.exit(0);
        });
    }

    /**
     * Preserve the Notes panic-exit on an intentional Home/recents departure without killing
     * the activity when a guarded camera/gallery/document picker is opening.
     */
    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (!isNotesFlavor() || panicExitStarted || OnlyUsUpdatePlugin.shouldKeepActivityAlive()) return;

        android.webkit.WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            panicExitHandler.postDelayed(() -> {
                if (!isAppForeground && !OnlyUsUpdatePlugin.shouldKeepActivityAlive()) exitNotesApp();
            }, 150L);
            return;
        }

        try {
            webView.evaluateJavascript(
                    "(function(){try{return Number(sessionStorage.getItem('onlyus_media_picker_until')||0)>Date.now()}catch(e){return false}})()",
                    pickerActive -> panicExitHandler.postDelayed(() -> {
                        if (panicExitStarted || isFinishing() || isDestroyed()
                                || isAppForeground || OnlyUsUpdatePlugin.shouldKeepActivityAlive()) return;
                        if ("true".equals(pickerActive)) {
                            scheduleMediaPickerExitFallback();
                        } else {
                            exitNotesApp();
                        }
                    }, 100L)
            );
        } catch (Exception e) {
            panicExitHandler.postDelayed(() -> {
                if (!isAppForeground && !OnlyUsUpdatePlugin.shouldKeepActivityAlive()) exitNotesApp();
            }, 150L);
        }
    }

    /**
     * Applies a previously staged web bundle early during startup, then checks
     * the OnlyUs Vercel deployment in the background. New bundles are staged
     * for the next launch so the live chat is never replaced mid-session.
     */
    private void initializeOtaUpdater() {
        final int currentVersionCode = getInstalledVersionCode();
        otaHandler.post(() -> {
            try {
                OtaUpdateManager.applySavedOtaIfValid(MainActivity.this, currentVersionCode);
            } catch (Exception e) {
                Log.w("OnlyUsOTA", "Could not apply saved OTA bundle", e);
            }
        });

        if (!otaCheckStarted) {
            otaCheckStarted = true;
            otaHandler.postDelayed(() -> {
                if (!isFinishing() && !isDestroyed()) {
                    OtaUpdateManager.checkAndSyncInBackground(
                        MainActivity.this, currentVersionCode, System.currentTimeMillis()
                    );
                }
            }, 1200L);
        }
    }

    private int getInstalledVersionCode() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return (int) info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (Exception e) {
            return 1;
        }
    }

    /**
     * Never hot-swap assets over a mounted chat. OtaUpdateManager will keep a
     * verified download pending until the next process launch.
     */
    public boolean isWebAppMounted() {
        return true;
    }

    public void notifyOtaState(final String state, final int percent, final String errorMsg) {
        if ("error".equals(state)) {
            Log.w("OnlyUsOTA", errorMsg != null ? errorMsg : "OTA update failed");
        }
    }

    public void reinjectBridgeAfterNavigation() {
        // Capacitor reinitializes its native bridge when the local WebView bundle loads.
    }

    private void requestAppPermissions(boolean isNotes) {
        List<String> needed = new ArrayList<>();

        // Microphone (voice notes)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }

        // Camera (photos & media)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }

        // Android 13+ (API 33+) granular media & notifications
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
            // Rahul's Direct edition needs Notifications
            if (!isNotes) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.POST_NOTIFICATIONS);
                }
            }
        } else {
            // Android 12 and below storage
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebView webView = getBridge().getWebView();
            android.webkit.WebSettings settings = webView.getSettings();

            // Enable hardware layer acceleration
            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

            // Performance & storage tuning
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
            settings.setLoadsImagesAutomatically(true);

            if (getPackageName().contains("notes")) {
                String currentUa = settings.getUserAgentString();
                if (!currentUa.contains("OnlyUsFlavor/Notes")) {
                    settings.setUserAgentString(currentUa + " OnlyUsFlavor/Notes");
                }
            }
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER && getPackageName().contains("notes")) {
            long curTime = System.currentTimeMillis();
            if ((curTime - lastUpdate) > 100) {
                long diffTime = (curTime - lastUpdate);
                lastUpdate = curTime;

                float x = event.values[0];
                float y = event.values[1];
                float z = event.values[2];

                float speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;

                if (speed > SHAKE_THRESHOLD) {
                    // Panic shake detected: kill activity immediately & clear from Recent Apps
                    finishAndRemoveTask();
                    System.exit(0);
                }

                lastX = x;
                lastY = y;
                lastZ = z;
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void onPause() {
        super.onPause();
        isAppForeground = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        // Do not kill the Notes activity here. Android also calls onStop when an external
        // camera, document picker, or photo picker takes focus. The JS vault auto-locks
        // on genuine backgrounding; killing the Activity here discards media-picker results.
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // UI-hidden memory callbacks also occur while external camera/picker activities
        // are open, so never force-kill the Notes activity from this callback.
        // FLAG_SECURE and the JS stealth auto-lock remain enabled.
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppForeground = true;
        cancelMediaPickerExitFallback();
        OnlyUsUpdatePlugin.onActivityResumed(this);
        if (sensorManager != null && accelerometer != null && getPackageName().contains("notes")) {
            try {
                sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
            } catch (RuntimeException e) {
                // OEMs may invalidate the sensor service while the task returns from background.
                Log.w("OnlyUsNotesStartup", "Could not resume shake-to-exit sensor", e);
            }
        }

        // Clear stale chat alerts and saved history whenever the standard app opens.
        // The Notes stealth edition remains completely untouched.
        if (!getPackageName().contains("notes")) {
            OnlyUsNotificationPlugin.clearConversationNotification(this);
            try {
                android.content.Intent serviceIntent = new android.content.Intent(this, OnlyUsSyncService.class);
                startService(serviceIntent);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onDestroy() {
        cancelMediaPickerExitFallback();
        if (screenOffReceiver != null) {
            try {
                unregisterReceiver(screenOffReceiver);
            } catch (IllegalArgumentException ignored) {}
            screenOffReceiver = null;
        }
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }

    public static void notifyReplyReceivedInApp(final String text) {
        if (instance != null && instance.getBridge() != null && instance.getBridge().getWebView() != null) {
            instance.runOnUiThread(() -> {
                try {
                    String escaped = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                    instance.getBridge().getWebView().evaluateJavascript(
                        "if (typeof window !== 'undefined' && window.onNativeDirectReplyReceived) { window.onNativeDirectReplyReceived('" + escaped + "'); }",
                        null
                    );
                } catch (Exception ignored) {}
            });
        }
    }
}
