package com.onlyus.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Self-contained Local-Storage OTA Manager for Capacitor.
 * - Boots the WebView at 0ms native speed from local internal storage (getFilesDir()).
 * - Checks https://onlyus69.vercel.app/ota-manifest.json in the background.
 * - Copies unchanged assets directly from built-in APK assets or the previous local bundle.
 * - Downloads ONLY the modified JS/CSS/HTML chunks, verifies hashes, stages the bundle, and
 *   activates it only at a safe startup point without requiring a new APK build.
 */
public class OtaUpdateManager {
    private static final String TAG = "OtaUpdateManager";
    private static final String PREFS_NAME = "onlyus_ota_prefs";
    private static final String KEY_ACTIVE_PATH = "active_ota_path";
    private static final String KEY_ACTIVE_HASH = "active_ota_hash";
    private static final String KEY_APK_VERSION_CODE = "apk_version_code";
    private static final String KEY_PENDING_PATH = "pending_ota_path";
    private static final String KEY_PENDING_HASH = "pending_ota_hash";
    private static final String REMOTE_BASE_URL = "https://onlyus69.vercel.app";

    private static final ExecutorService sExecutor = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean sIsSyncing = new AtomicBoolean(false);
    private static volatile String sStartupState = "idle";
    private static volatile int sStartupProgress = 0;

    public static void beginStartupOtaCheck() {
        sStartupState = "checking";
        sStartupProgress = 0;
    }

    public static void setStartupOtaState(String state, int progress, String errorMsg) {
        sStartupState = state != null ? state : "idle";
        sStartupProgress = Math.max(0, Math.min(100, progress));
    }

    public static String getStartupOtaState() {
        return sStartupState;
    }

    public static int getStartupOtaProgress() {
        return sStartupProgress;
    }

    /**
     * Called during MainActivity.onCreate() to boot immediately from the latest verified
     * local OTA directory on internal flash storage if present.
     */
    public static void applySavedOtaIfValid(MainActivity activity, int currentApkVersionCode) {
        try {
            SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            int savedApkCode = prefs.getInt(KEY_APK_VERSION_CODE, -1);

            // If the user just installed a newer native APK, reset old OTA bundles so the new APK's
            // built-in assets take priority until a newer web OTA is published.
            if (savedApkCode != -1 && savedApkCode != currentApkVersionCode) {
                Log.d(TAG, "New APK version detected (" + currentApkVersionCode + "), clearing legacy OTA bundles.");
                clearAllOtaDirectories(activity.getFilesDir());
                prefs.edit()
                        .remove(KEY_ACTIVE_PATH)
                        .remove(KEY_ACTIVE_HASH)
                        .remove(KEY_PENDING_PATH)
                        .remove(KEY_PENDING_HASH)
                        .putInt(KEY_APK_VERSION_CODE, currentApkVersionCode)
                        .apply();
                return;
            }

            if (savedApkCode == -1) {
                prefs.edit().putInt(KEY_APK_VERSION_CODE, currentApkVersionCode).apply();
            }

            // A completed OTA is first staged as pending. Promote it only at app startup,
            // before the dashboard can mount, so slow/background downloads never replace the
            // WebView underneath an active session.
            String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
            String pendingHash = prefs.getString(KEY_PENDING_HASH, null);
            if (pendingPath != null && pendingHash != null) {
                File pendingDir = new File(pendingPath);
                File pendingIndex = new File(pendingDir, "index.html");
                if (pendingDir.exists() && pendingDir.isDirectory() && pendingIndex.exists() && pendingIndex.length() > 0) {
                    prefs.edit()
                            .putString(KEY_ACTIVE_PATH, pendingPath)
                            .putString(KEY_ACTIVE_HASH, pendingHash)
                            .remove(KEY_PENDING_PATH)
                            .remove(KEY_PENDING_HASH)
                            .apply();
                } else {
                    prefs.edit().remove(KEY_PENDING_PATH).remove(KEY_PENDING_HASH).apply();
                }
            }

            String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
            if (activePath != null && !activePath.isEmpty()) {
                File dir = new File(activePath);
                File indexFile = new File(dir, "index.html");
                if (dir.exists() && dir.isDirectory() && indexFile.exists() && indexFile.length() > 0) {
                    if (activity.getBridge() != null) {
                        Log.d(TAG, "Booting from local OTA bundle: " + activePath);
                        activity.getBridge().setServerBasePath(activePath);
                        activity.reinjectBridgeAfterNavigation();
                    }
                } else {
                    prefs.edit().remove(KEY_ACTIVE_PATH).remove(KEY_ACTIVE_HASH).apply();
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to apply saved OTA bundle, falling back to built-in APK assets", e);
        }
    }

    /**
     * Checks https://onlyus69.vercel.app/ota-manifest.json in the background and performs
     * an incremental local sync if a newer web build is deployed.
     */
    public static void checkAndSyncInBackground(final MainActivity activity, final int currentApkVersionCode, final long appLaunchTimestamp) {
        if (!sIsSyncing.compareAndSet(false, true)) {
            return;
        }

        sExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    performOtaSync(activity, currentApkVersionCode, appLaunchTimestamp);
                } catch (Exception e) {
                    Log.w(TAG, "Background OTA check skipped or failed: " + e.getMessage());
                    setStartupOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "OTA check failed");
                    activity.notifyOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "OTA check failed");
                } finally {
                    sIsSyncing.set(false);
                }
            }
        });
    }

    private static void performOtaSync(final MainActivity activity, int currentApkVersionCode, long appLaunchTimestamp) throws Exception {
        setStartupOtaState("checking", 0, "");
        activity.notifyOtaState("checking", 0, "");
        SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String currentActiveHash = prefs.getString(KEY_ACTIVE_HASH, null);
        String currentActivePath = prefs.getString(KEY_ACTIVE_PATH, null);
        String pendingOtaHash = prefs.getString(KEY_PENDING_HASH, null);
        String pendingOtaPath = prefs.getString(KEY_PENDING_PATH, null);

        // 1. Read built-in APK asset manifest (if packaged)
        JSONObject builtInManifest = readBuiltInAssetManifest(activity.getAssets());
        String builtInHash = builtInManifest != null ? builtInManifest.optString("bundleHash", "") : "";

        // 2. Fetch remote ota-manifest.json from Vercel
        String manifestUrl = REMOTE_BASE_URL + "/ota-manifest.json?t=" + System.currentTimeMillis();
        String remoteJsonStr = downloadString(manifestUrl);
        if (remoteJsonStr == null || remoteJsonStr.isEmpty()) {
            setStartupOtaState("idle", 100, "");
            activity.notifyOtaState("idle", 100, "");
            return;
        }

        JSONObject remoteManifest = new JSONObject(remoteJsonStr);
        final String remoteHash = remoteManifest.optString("bundleHash", "");
        JSONArray remoteFiles = remoteManifest.optJSONArray("files");
        if (remoteHash.isEmpty() || remoteFiles == null || remoteFiles.length() == 0) {
            setStartupOtaState("error", 0, "Invalid OTA manifest");
            activity.notifyOtaState("error", 0, "Invalid OTA manifest");
            return;
        }

        // If already running this exact bundle hash, nothing to do.
        if (remoteHash.equals(currentActiveHash) && currentActivePath != null && new File(currentActivePath, "index.html").exists()) {
            if (pendingOtaPath != null) {
                prefs.edit().remove(KEY_PENDING_PATH).remove(KEY_PENDING_HASH).apply();
            }
            Log.d(TAG, "Local OTA bundle is already up to date (" + remoteHash + ")");
            setStartupOtaState("idle", 100, "");
            activity.notifyOtaState("idle", 100, "");
            cleanupOldBundlesExcept(activity.getFilesDir(), new File(currentActivePath).getName(), null);
            return;
        }

        // If the same bundle was already downloaded but not activated, do not download it again.
        if (remoteHash.equals(pendingOtaHash) && pendingOtaPath != null) {
            File pendingDir = new File(pendingOtaPath);
            File pendingIndex = new File(pendingDir, "index.html");
            if (pendingDir.exists() && pendingIndex.exists() && pendingIndex.length() > 0) {
                if (!activity.isWebAppMounted()) {
                    final File pendingTarget = pendingDir;
                    final String pendingHashFinal = pendingOtaHash;
                    final String previousActivePath = currentActivePath;
                    setStartupOtaState("ready", 100, "");
                    activity.notifyOtaState("ready", 100, "");
                    activity.runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                if (activity.getBridge() != null && !activity.isWebAppMounted()) {
                                    activity.getBridge().setServerBasePath(pendingTarget.getAbsolutePath());
                                    activity.reinjectBridgeAfterNavigation();
                                    SharedPreferences p = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                                    p.edit()
                                            .putString(KEY_ACTIVE_PATH, pendingTarget.getAbsolutePath())
                                            .putString(KEY_ACTIVE_HASH, pendingHashFinal)
                                            .remove(KEY_PENDING_PATH)
                                            .remove(KEY_PENDING_HASH)
                                            .apply();
                                    cleanupOldBundlesExcept(
                                            activity.getFilesDir(),
                                            pendingTarget.getName(),
                                            previousActivePath != null ? new File(previousActivePath).getName() : null
                                    );
                                    setStartupOtaState("applied", 100, "");
                                    activity.notifyOtaState("applied", 100, "");
                                }
                            } catch (Exception e) {
                                Log.e(TAG, "Error activating pending OTA bundle", e);
                                setStartupOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "Activation failed");
                                activity.notifyOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "Activation failed");
                            }
                        }
                    });
                } else {
                    setStartupOtaState("deferred", 100, "");
                    activity.notifyOtaState("deferred", 100, "");
                }
                return;
            }
        }

        // If remote matches the built-in APK assets and we are already using built-in assets
        if (remoteHash.equals(builtInHash) && (currentActiveHash == null || currentActiveHash.isEmpty())) {
            Log.d(TAG, "Built-in APK assets match remote bundle (" + remoteHash + ")");
            setStartupOtaState("idle", 100, "");
            activity.notifyOtaState("idle", 100, "");
            return;
        }

        // If remote rolled back to the built-in APK's exact version, switch back to built-in assets
        if (remoteHash.equals(builtInHash)) {
            clearAllOtaDirectories(activity.getFilesDir());
            prefs.edit().remove(KEY_ACTIVE_PATH).remove(KEY_ACTIVE_HASH).remove(KEY_PENDING_PATH).remove(KEY_PENDING_HASH).apply();
            setStartupOtaState("idle", 100, "");
            activity.notifyOtaState("idle", 100, "");
            return;
        }

        Log.d(TAG, "New web OTA bundle available: " + remoteHash + " (current: " + (currentActiveHash != null ? currentActiveHash : builtInHash) + ")");
        setStartupOtaState("updating", 0, "");
        activity.notifyOtaState("updating", 0, "");

        // 3. Build hash lookup map of built-in APK assets to avoid re-downloading unchanged images/files
        Map<String, String> builtInFileHashes = new HashMap<>();
        if (builtInManifest != null) {
            JSONArray bFiles = builtInManifest.optJSONArray("files");
            if (bFiles != null) {
                for (int i = 0; i < bFiles.length(); i++) {
                    JSONObject f = bFiles.optJSONObject(i);
                    if (f != null) {
                        builtInFileHashes.put(f.optString("path"), f.optString("hash"));
                    }
                }
            }
        }

        // Also build lookup map from current active OTA directory if one exists
        File currentActiveDir = (currentActivePath != null) ? new File(currentActivePath) : null;
        Map<String, String> activeOtaFileHashes = new HashMap<>();
        if (currentActiveDir != null && currentActiveDir.exists()) {
            File activeManifestFile = new File(currentActiveDir, "ota-manifest.json");
            if (activeManifestFile.exists()) {
                try {
                    String activeManifestStr = readFileToString(activeManifestFile);
                    JSONObject activeManifestJson = new JSONObject(activeManifestStr);
                    JSONArray aFiles = activeManifestJson.optJSONArray("files");
                    if (aFiles != null) {
                        for (int i = 0; i < aFiles.length(); i++) {
                            JSONObject f = aFiles.optJSONObject(i);
                            if (f != null) {
                                activeOtaFileHashes.put(f.optString("path"), f.optString("hash"));
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }
        }

        // 4. Prepare clean staging directory
        File filesDir = activity.getFilesDir();
        File stagingDir = new File(filesDir, "ota_staging");
        if (stagingDir.exists()) {
            deleteRecursive(stagingDir);
        }
        if (!stagingDir.mkdirs()) {
            throw new Exception("Could not create ota_staging directory");
        }

        AssetManager assetManager = activity.getAssets();
        int copiedLocallyCount = 0;
        int downloadedNetworkCount = 0;

        for (int i = 0; i < remoteFiles.length(); i++) {
            JSONObject fileEntry = remoteFiles.getJSONObject(i);
            String relPath = fileEntry.getString("path");
            String expectedHash = fileEntry.getString("hash");

            // Prevent path traversal
            if (relPath.contains("..") || relPath.startsWith("/")) {
                continue;
            }

            File destFile = new File(stagingDir, relPath);
            File parent = destFile.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }

            boolean reusedLocal = false;

            // Fast Path A: Copy from current active OTA folder if hash is identical
            if (currentActiveDir != null && expectedHash.equals(activeOtaFileHashes.get(relPath))) {
                File existingFile = new File(currentActiveDir, relPath);
                if (existingFile.exists() && copyFile(existingFile, destFile)) {
                    if (computeSha256(destFile).equals(expectedHash)) {
                        reusedLocal = true;
                        copiedLocallyCount++;
                    }
                }
            }

            // Fast Path B: Copy from built-in APK assets/public/<relPath> if present & hash matches
            if (!reusedLocal) {
                try {
                    if (copyAssetToFile(assetManager, "public/" + relPath, destFile)) {
                        if (computeSha256(destFile).equals(expectedHash)) {
                            reusedLocal = true;
                            copiedLocallyCount++;
                        } else {
                            destFile.delete();
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Network Path: Download modified/new file from Vercel
            if (!reusedLocal) {
                String fileUrl = REMOTE_BASE_URL + "/" + encodeUrlPath(relPath);
                if (!downloadFile(fileUrl, destFile)) {
                    deleteRecursive(stagingDir);
                    throw new Exception("Failed to download OTA file: " + relPath);
                }
                String actualHash = computeSha256(destFile);
                if (!actualHash.equals(expectedHash)) {
                    deleteRecursive(stagingDir);
                    throw new Exception("Hash mismatch for " + relPath + ": expected " + expectedHash + ", got " + actualHash);
                }
                downloadedNetworkCount++;
            }
        }

        // Write ota-manifest.json into stagingDir as well
        File stagingManifest = new File(stagingDir, "ota-manifest.json");
        try (FileOutputStream fos = new FileOutputStream(stagingManifest)) {
            fos.write(remoteJsonStr.getBytes(StandardCharsets.UTF_8));
        }

        // Verify index.html exists in staging
        File stagingIndex = new File(stagingDir, "index.html");
        if (!stagingIndex.exists() || stagingIndex.length() == 0) {
            deleteRecursive(stagingDir);
            throw new Exception("Staging index.html missing after sync");
        }

        // 5. Atomically promote stagingDir to final bundle directory
        final File targetBundleDir = new File(filesDir, "ota_bundle_" + remoteHash);
        if (targetBundleDir.exists()) {
            deleteRecursive(targetBundleDir);
        }
        if (!stagingDir.renameTo(targetBundleDir)) {
            deleteRecursive(stagingDir);
            throw new Exception("Failed to rename staging directory to target bundle directory");
        }

        // Save the finished bundle as pending, not active. The active bundle remains untouched
        // while the user is interacting with the app.
        prefs.edit()
                .putString(KEY_PENDING_PATH, targetBundleDir.getAbsolutePath())
                .putString(KEY_PENDING_HASH, remoteHash)
                .putInt(KEY_APK_VERSION_CODE, currentApkVersionCode)
                .apply();

        Log.d(TAG, "OTA staging complete! Reused locally: " + copiedLocallyCount + ", downloaded: " + downloadedNetworkCount + " files.");

        final boolean canActivateNow = !activity.isWebAppMounted();
        final String previousActivePath = currentActivePath;
        setStartupOtaState("ready", 100, "");
        activity.notifyOtaState("ready", 100, "");

        // Activate only while the loading screen still owns startup. If the dashboard is already
        // mounted, keep the bundle pending for the next launch instead of reloading the WebView.
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (activity.getBridge() != null && canActivateNow && !activity.isWebAppMounted()) {
                        activity.getBridge().setServerBasePath(targetBundleDir.getAbsolutePath());
                        activity.reinjectBridgeAfterNavigation();
                        SharedPreferences p = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                        p.edit()
                                .putString(KEY_ACTIVE_PATH, targetBundleDir.getAbsolutePath())
                                .putString(KEY_ACTIVE_HASH, remoteHash)
                                .remove(KEY_PENDING_PATH)
                                .remove(KEY_PENDING_HASH)
                                .apply();
                        cleanupOldBundlesExcept(
                                filesDir,
                                targetBundleDir.getName(),
                                previousActivePath != null ? new File(previousActivePath).getName() : null
                        );
                        setStartupOtaState("applied", 100, "");
                        activity.notifyOtaState("applied", 100, "");
                    } else {
                        setStartupOtaState("deferred", 100, "");
                        activity.notifyOtaState("deferred", 100, "");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error activating OTA bundle after staging", e);
                    setStartupOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "Activation failed");
                    activity.notifyOtaState("error", 0, e.getMessage() != null ? e.getMessage() : "Activation failed");
                }
            }
        });
    }

    public static String getActiveOtaHash(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_ACTIVE_HASH, "builtin");
    }

    private static JSONObject readBuiltInAssetManifest(AssetManager assets) {
        try (InputStream is = assets.open("public/ota-manifest.json")) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return new JSONObject(baos.toString("UTF-8"));
        } catch (Exception e) {
            return null;
        }
    }

    private static String downloadString(String urlStr) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(4000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache");
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return null;
            }
            try (InputStream is = new BufferedInputStream(conn.getInputStream());
                 ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) {
                    baos.write(buf, 0, n);
                }
                return baos.toString("UTF-8");
            }
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static boolean downloadFile(String urlStr, File destFile) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setInstanceFollowRedirects(true);
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return false;
            }
            try (InputStream is = new BufferedInputStream(conn.getInputStream());
                 FileOutputStream fos = new FileOutputStream(destFile)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = is.read(buf)) != -1) {
                    fos.write(buf, 0, n);
                }
                fos.flush();
                return true;
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static boolean copyAssetToFile(AssetManager assets, String assetPath, File destFile) {
        try (InputStream is = assets.open(assetPath);
             FileOutputStream fos = new FileOutputStream(destFile)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                fos.write(buf, 0, n);
            }
            fos.flush();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean copyFile(File src, File dst) {
        try (FileInputStream fis = new FileInputStream(src);
             FileOutputStream fos = new FileOutputStream(dst)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                fos.write(buf, 0, n);
            }
            fos.flush();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String readFileToString(File file) throws Exception {
        try (FileInputStream fis = new FileInputStream(file);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = fis.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return baos.toString("UTF-8");
        }
    }

    private static String computeSha256(File file) {
        try (InputStream fis = new BufferedInputStream(new FileInputStream(file))) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                digest.update(buf, 0, n);
            }
            byte[] hashBytes = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < hashBytes.length; i++) {
                sb.append(String.format("%02x", hashBytes[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String encodeUrlPath(String relPath) {
        String[] parts = relPath.split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append("/");
            sb.append(parts[i].replace(" ", "%20"));
        }
        return sb.toString();
    }

    private static void cleanupOldBundlesExcept(File filesDir, String keepDirName, String alsoKeepDirName) {
        File[] children = filesDir.listFiles();
        if (children == null) return;
        for (File child : children) {
            String name = child.getName();
            boolean keep = name.equals(keepDirName) || (alsoKeepDirName != null && name.equals(alsoKeepDirName));
            if ((name.startsWith("ota_bundle_") || name.equals("ota_staging")) && !keep) {
                deleteRecursive(child);
            }
        }
    }

    private static void clearAllOtaDirectories(File filesDir) {
        cleanupOldBundlesExcept(filesDir, "", null);
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) {
                for (File c : children) {
                    deleteRecursive(c);
                }
            }
        }
        try {
            f.delete();
        } catch (Exception ignored) {}
    }
}
