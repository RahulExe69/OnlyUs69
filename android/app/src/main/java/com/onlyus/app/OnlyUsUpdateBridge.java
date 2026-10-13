package com.onlyus.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

public final class OnlyUsUpdateBridge {
    private static final String TAG = "OnlyUsApkUpdate";
    private static final String ALLOWED_DOWNLOAD_PREFIX =
            "https://github.com/RahulExe69/OnlyUs69-Releases/releases/download/";
    private static final String PREFS_NAME = "onlyus_apk_update_prefs";
    private static final int MAX_APK_BYTES = 200 * 1024 * 1024;

    private final MainActivity activity;
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);
    private final SharedPreferences preferences;
    private volatile File pendingApkFile;
    private volatile long pendingVersionCode = -1L;
    private volatile String pendingVersionName = "";
    private volatile String pendingSha256 = "";
    private volatile boolean waitingForInstallPermission = false;
    private volatile boolean installerLaunched = false;

    public OnlyUsUpdateBridge(MainActivity activity) {
        this.activity = activity;
        this.preferences = activity.getSharedPreferences(PREFS_NAME, 0);
        File file = getUpdateApkFile();
        if (file.exists()) {
            pendingApkFile = file;
            pendingVersionCode = preferences.getLong("pending_version_code", -1L);
            pendingVersionName = preferences.getString("pending_version_name", "");
            pendingSha256 = preferences.getString("pending_sha256", "");
        }
    }

    @JavascriptInterface
    public String getPackageName() {
        return activity.getPackageName();
    }

    @JavascriptInterface
    public String getInstalledVersionName() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return info.versionName != null ? info.versionName : "1.0.0";
        } catch (Exception e) {
            return "1.0.0";
        }
    }

    @JavascriptInterface
    public long getInstalledVersionCode() {
        try {
            PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return getVersionCode(info);
        } catch (Exception e) {
            return 1L;
        }
    }

    @JavascriptInterface
    public boolean downloadAndInstallUpdate(
            final String downloadUrl,
            final String expectedPackageId,
            final String expectedVersionName,
            final String expectedVersionCodeValue,
            final String expectedSha256,
            final String expectedSizeBytesValue) {
        final long expectedVersionCode;
        final long expectedSizeBytes;
        final String cleanHash = expectedSha256 == null ? "" : expectedSha256.trim().toLowerCase(Locale.ROOT);

        if (!isAllowedDownloadUrl(downloadUrl)
                || !activity.getPackageName().equals(expectedPackageId)
                || !cleanHash.matches("[0-9a-f]{64}")) {
            notifyProgress("error", 0, 0, 0, "The update package information is invalid.");
            return false;
        }
        try {
            expectedVersionCode = Long.parseLong(expectedVersionCodeValue);
            expectedSizeBytes = Long.parseLong(expectedSizeBytesValue);
        } catch (Exception e) {
            notifyProgress("error", 0, 0, 0, "The update package information is invalid.");
            return false;
        }
        if (expectedVersionCode <= getInstalledVersionCode()
                || expectedVersionCode <= 0
                || expectedSizeBytes <= 0
                || expectedSizeBytes > MAX_APK_BYTES
                || expectedVersionName == null
                || expectedVersionName.trim().isEmpty()) {
            notifyProgress("error", 0, 0, 0, "The update version or file size is not valid.");
            return false;
        }
        if (!downloadInProgress.compareAndSet(false, true)) {
            return true;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            File tempFile = getUpdateApkFile();
            long downloaded = 0L;
            try {
                File parent = tempFile.getParentFile();
                if (parent == null || (!parent.exists() && !parent.mkdirs())) {
                    throw new Exception("Could not create the update cache directory.");
                }
                if (tempFile.exists() && !tempFile.delete()) {
                    throw new Exception("Could not replace the previous temporary APK.");
                }

                URL url = new URL(downloadUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.setUseCaches(false);
                connection.setRequestProperty("User-Agent", "OnlyUs-Android-Updater");
                connection.setRequestProperty("Accept", "application/octet-stream");

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("APK download returned HTTP " + responseCode + ".");
                }
                String finalHost = connection.getURL().getHost();
                if (!"github.com".equalsIgnoreCase(finalHost)
                        && (finalHost == null || !finalHost.toLowerCase(Locale.ROOT).endsWith(".githubusercontent.com"))) {
                    throw new Exception("The APK download redirected to an unexpected host.");
                }

                long contentLength = connection.getContentLengthLong();
                if (contentLength > MAX_APK_BYTES || (contentLength > 0 && contentLength != expectedSizeBytes)) {
                    throw new Exception("The downloaded APK size does not match the release metadata.");
                }

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long totalBytes = expectedSizeBytes > 0 ? expectedSizeBytes : contentLength;
                notifyProgress("downloading", 0, 0, totalBytes, "");

                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream output = new FileOutputStream(tempFile)) {
                    byte[] buffer = new byte[32 * 1024];
                    int read;
                    long lastNotify = 0L;
                    while ((read = input.read(buffer)) != -1) {
                        if (!downloadInProgress.get()) {
                            throw new Exception("Download cancelled.");
                        }
                        downloaded += read;
                        if (downloaded > MAX_APK_BYTES || downloaded > expectedSizeBytes) {
                            throw new Exception("The APK is larger than the published file size.");
                        }
                        digest.update(buffer, 0, read);
                        output.write(buffer, 0, read);
                        long now = System.currentTimeMillis();
                        if (now - lastNotify >= 100L) {
                            lastNotify = now;
                            int percent = (int) Math.min(99L, (downloaded * 100L) / Math.max(1L, totalBytes));
                            notifyProgress("downloading", percent, downloaded, totalBytes, "");
                        }
                    }
                    output.flush();
                }

                if (downloaded != expectedSizeBytes) {
                    throw new Exception("The downloaded APK size does not match the release metadata.");
                }
                String actualHash = toHex(digest.digest());
                if (!actualHash.equalsIgnoreCase(cleanHash)) {
                    throw new Exception("APK checksum verification failed. The download was discarded.");
                }

                PackageInfo archiveInfo = activity.getPackageManager().getPackageArchiveInfo(tempFile.getAbsolutePath(), 0);
                if (archiveInfo == null || !activity.getPackageName().equals(archiveInfo.packageName)) {
                    throw new Exception("This APK is not the correct edition for the installed app.");
                }
                long archiveVersionCode = getVersionCode(archiveInfo);
                if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= getInstalledVersionCode()) {
                    throw new Exception("The APK version does not match the advertised update.");
                }

                pendingApkFile = tempFile;
                pendingVersionCode = expectedVersionCode;
                pendingVersionName = expectedVersionName;
                pendingSha256 = cleanHash;
                preferences.edit()
                        .putLong("pending_version_code", pendingVersionCode)
                        .putString("pending_version_name", pendingVersionName)
                        .putString("pending_sha256", pendingSha256)
                        .apply();

                notifyProgress("downloading", 100, downloaded, totalBytes, "");
                activity.runOnUiThread(this::launchNativePackageInstaller);
            } catch (Exception e) {
                Log.w(TAG, "APK update failed: " + e.getMessage(), e);
                if (tempFile.exists() && (pendingApkFile == null || !tempFile.equals(pendingApkFile))) {
                    tempFile.delete();
                } else if (tempFile.exists() && !verifyPendingFile(tempFile, expectedPackageId, expectedVersionCode, cleanHash)) {
                    tempFile.delete();
                }
                notifyProgress("error", 0, downloaded, expectedSizeBytes,
                        e.getMessage() != null ? e.getMessage() : "The APK download failed.");
            } finally {
                if (connection != null) connection.disconnect();
                downloadInProgress.set(false);
            }
        }, "OnlyUsApkDownload").start();

        return true;
    }

    @JavascriptInterface
    public boolean installPendingUpdate() {
        File file = pendingApkFile != null ? pendingApkFile : getUpdateApkFile();
        if (file == null || !file.exists()) return false;

        long versionCode = pendingVersionCode > 0
                ? pendingVersionCode
                : preferences.getLong("pending_version_code", -1L);
        String hash = !pendingSha256.isEmpty()
                ? pendingSha256
                : preferences.getString("pending_sha256", "");
        if (versionCode <= getInstalledVersionCode() || hash == null || !hash.matches("(?i)[0-9a-f]{64}")) {
            return false;
        }

        if (!verifyPendingFile(file, activity.getPackageName(), versionCode, hash)) {
            file.delete();
            preferences.edit()
                    .remove("pending_version_code")
                    .remove("pending_version_name")
                    .remove("pending_sha256")
                    .apply();
            pendingApkFile = null;
            return false;
        }

        pendingApkFile = file;
        pendingVersionCode = versionCode;
        pendingSha256 = hash;
        activity.runOnUiThread(this::launchNativePackageInstaller);
        return true;
    }

    @JavascriptInterface
    public void closeApp() {
        downloadInProgress.set(false);
        activity.runOnUiThread(() -> activity.finishAffinity());
    }

    public boolean shouldKeepActivityAlive() {
        return waitingForInstallPermission || installerLaunched;
    }

    public void onActivityResumed() {
        if (waitingForInstallPermission) {
            waitingForInstallPermission = false;
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                    || activity.getPackageManager().canRequestPackageInstalls()) {
                launchNativePackageInstaller();
            } else {
                notifyProgress("error", 0, 0, 0,
                        "Allow OnlyUs to install unknown apps in Android settings, then try again.");
            }
            return;
        }

        if (installerLaunched) {
            installerLaunched = false;
            if (pendingVersionCode > 0 && getInstalledVersionCode() >= pendingVersionCode) {
                notifyProgress("installed", 100, 0, 0, "");
                activity.runOnUiThread(() -> activity.finishAffinity());
            } else {
                notifyProgress("ready", 100, 0, 0,
                        "Installation was cancelled. Tap Try again to reopen Android's installer.");
            }
        }
    }

    private void launchNativePackageInstaller() {
        File file = pendingApkFile;
        if (file == null || !file.exists()) {
            notifyProgress("error", 0, 0, 0, "The downloaded APK is no longer available. Try again.");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !activity.getPackageManager().canRequestPackageInstalls()) {
                waitingForInstallPermission = true;
                notifyProgress("permission", 100, file.length(), file.length(),
                        "Allow installs from this app in Android settings.");
                Intent permissionIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(permissionIntent);
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    file);
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            installerLaunched = true;
            activity.startActivity(installIntent);
            notifyProgress("installer", 100, file.length(), file.length(), "");
        } catch (Exception e) {
            installerLaunched = false;
            Log.e(TAG, "Could not open Android's package installer", e);
            notifyProgress("error", 0, file.length(), file.length(),
                    "Could not open Android's installer. " + (e.getMessage() == null ? "" : e.getMessage()));
        }
    }

    private boolean verifyPendingFile(File file, String packageId, long expectedCode, String expectedHash) {
        try {
            if (file.length() <= 0 || file.length() > MAX_APK_BYTES) return false;
            String actualHash = sha256File(file);
            if (!actualHash.equalsIgnoreCase(expectedHash)) return false;
            PackageInfo info = activity.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
            return info != null
                    && packageId.equals(info.packageName)
                    && getVersionCode(info) == expectedCode
                    && expectedCode > getInstalledVersionCode();
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isAllowedDownloadUrl(String value) {
        if (value == null || !value.startsWith(ALLOWED_DOWNLOAD_PREFIX)) return false;
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "github.com".equalsIgnoreCase(uri.getHost())
                    && uri.getUserInfo() == null
                    && uri.getPort() == -1
                    && uri.getPath() != null
                    && uri.getPath().startsWith("/RahulExe69/OnlyUs69-Releases/releases/download/");
        } catch (Exception e) {
            return false;
        }
    }

    private File getUpdateApkFile() {
        return new File(new File(activity.getCacheDir(), "onlyus-updates"), "onlyus-update.apk");
    }

    private long getVersionCode(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    private String sha256File(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        return toHex(digest.digest());
    }

    private String toHex(byte[] data) {
        StringBuilder value = new StringBuilder(data.length * 2);
        for (byte b : data) value.append(String.format(Locale.ROOT, "%02x", b));
        return value.toString();
    }

    private void notifyProgress(String status, int percent, long downloaded, long total, String error) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("status", status);
            payload.put("progress", Math.max(0, Math.min(100, percent)));
            payload.put("downloadedBytes", Math.max(0, downloaded));
            payload.put("totalBytes", Math.max(0, total));
            payload.put("error", error == null ? "" : error);
            String javascript = "if (window.__onlyUsApkUpdateProgress) window.__onlyUsApkUpdateProgress("
                    + payload.toString() + ");";
            activity.runOnUiThread(() -> {
                try {
                    if (activity.getBridge() != null && activity.getBridge().getWebView() != null) {
                        activity.getBridge().getWebView().evaluateJavascript(javascript, null);
                    }
                } catch (Exception ignored) {}
            });
        } catch (Exception e) {
            Log.w(TAG, "Could not dispatch native updater state", e);
        }
    }
}
