package com.onlyus.app;

import android.Manifest;
import android.content.Context;
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
    private boolean otaCheckStarted = false;
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
        super.onCreate(savedInstanceState);
        instance = this;

        boolean isNotes = getPackageName().contains("notes");

        if (isNotes) {
            // 1. Prevent screenshots & hide preview in recent apps drawer
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );

            // 2. Register native accelerometer shake listener for instant panic exit
            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                if (accelerometer != null) {
                    sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
                }
            }
        }

        // 3. Request app-specific permissions on initial launch
        requestAppPermissions(isNotes);

        // Initialize the self-hosted web-bundle updater for both editions.
        initializeOtaUpdater();
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
        // If in notes flavor and the app is stopped (Home button, switched apps, minimized, or screen locked)
        if (getPackageName().contains("notes")
                && (!OnlyUsUpdatePlugin.shouldKeepActivityAlive())) {
            finishAndRemoveTask();
            System.exit(0);
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // If system is trimming memory or user pressed UI overview/home
        if (getPackageName().contains("notes")
                && level >= TRIM_MEMORY_UI_HIDDEN
                && (!OnlyUsUpdatePlugin.shouldKeepActivityAlive())) {
            finishAndRemoveTask();
            System.exit(0);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppForeground = true;
        OnlyUsUpdatePlugin.onActivityResumed(this);
        if (sensorManager != null && accelerometer != null && getPackageName().contains("notes")) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        }

        // Start background message sync service for Rahul's edition
        if (!getPackageName().contains("notes")) {
            try {
                android.content.Intent serviceIntent = new android.content.Intent(this, OnlyUsSyncService.class);
                startService(serviceIntent);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onDestroy() {
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
