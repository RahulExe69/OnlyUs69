package com.onlyus.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Bundle;
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
                    panicKillNow();
                }

                lastX = x;
                lastY = y;
                lastZ = z;
            }
        }
    }

    public void panicKillNow() {
        runOnUiThread(() -> {
            try {
                if (sensorManager != null) {
                    sensorManager.unregisterListener(this);
                }
            } catch (Exception ignored) {}

            try {
                android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    List<android.app.ActivityManager.AppTask> appTasks = am.getAppTasks();
                    if (appTasks != null) {
                        for (android.app.ActivityManager.AppTask task : appTasks) {
                            try {
                                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                                    task.setExcludeFromRecents(true);
                                }
                            } catch (Exception ignored) {}
                            task.finishAndRemoveTask();
                        }
                    }
                }
            } catch (Exception ignored) {}

            try {
                finishAffinity();
                finishAndRemoveTask();
            } catch (Exception ignored) {}

            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    android.os.Process.killProcess(android.os.Process.myPid());
                } catch (Exception ignored) {}
                System.exit(0);
            }, 250);
        });
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
        if (getPackageName().contains("notes")) {
            panicKillNow();
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // If system is trimming memory or user pressed UI overview/home
        if (getPackageName().contains("notes") && level >= TRIM_MEMORY_UI_HIDDEN) {
            panicKillNow();
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardOAuthUrlIfPresent(intent);
    }

    private void forwardOAuthUrlIfPresent(android.content.Intent intent) {
        if (intent != null && intent.getData() != null) {
            final String url = intent.getData().toString();
            if (url.startsWith("com.onlyus.app://") || url.contains("/auth/callback")) {
                // Clear intent data and reset intent to prevent re-triggering on subsequent onResume
                intent.setData(null);
                setIntent(new android.content.Intent(android.content.Intent.ACTION_MAIN));

                if (getBridge() != null && getBridge().getWebView() != null) {
                    runOnUiThread(() -> {
                        try {
                            String escaped = url.replace("\\", "\\\\").replace("'", "\\'");
                            getBridge().getWebView().evaluateJavascript(
                                "if (typeof window !== 'undefined') { " +
                                "  if (typeof window.onNativeOAuthCallbackReceived === 'function') { " +
                                "    window.onNativeOAuthCallbackReceived('" + escaped + "'); " +
                                "  } else { " +
                                "    window.__pendingOAuthUrl = '" + escaped + "'; " +
                                "  } " +
                                "}",
                                null
                            );
                        } catch (Exception ignored) {}
                    });
                }
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppForeground = true;
        if (sensorManager != null && accelerometer != null && getPackageName().contains("notes")) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        }

        // Start background message sync service for Rahul's edition
        if (!getPackageName().contains("notes")) {
            try {
                android.content.Intent serviceIntent = new android.content.Intent(this, OnlyUsSyncService.class);
                startService(serviceIntent);
            } catch (Exception ignored) {}
            forwardOAuthUrlIfPresent(getIntent());
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
