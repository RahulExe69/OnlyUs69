package com.onlyus.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OnlyUsTheme")
public final class OnlyUsThemePlugin extends Plugin {
    @PluginMethod
    public void setSystemBarColors(PluginCall call) {
        final String requestedColor = call.getString("backgroundColor", "#0E0F18");
        final boolean darkIcons = call.getBoolean("darkIcons", false);
        final int color;
        try {
            color = Color.parseColor(requestedColor);
        } catch (IllegalArgumentException exception) {
            call.reject("Invalid system-bar background color.", exception);
            return;
        }

        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("The OnlyUs activity is not available.");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Window window = activity.getWindow();
                View decor = window.getDecorView();

                // Supplies the themed surface behind transparent/edge-to-edge
                // system bars on Android 15+ as well as any uncovered window area.
                decor.setBackgroundColor(color);
                window.setStatusBarColor(color);
                window.setNavigationBarColor(color);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.setStatusBarContrastEnforced(false);
                    window.setNavigationBarContrastEnforced(false);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        int appearanceMask =
                            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        int appearance = darkIcons ? appearanceMask : 0;
                        controller.setSystemBarsAppearance(appearance, appearanceMask);
                    }
                } else {
                    int flags = decor.getSystemUiVisibility();
                    if (darkIcons) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    } else {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    }
                    decor.setSystemUiVisibility(flags);
                }

                Bridge bridge = getBridge();
                if (bridge != null) {
                    WebView webView = bridge.getWebView();
                    if (webView != null) webView.setBackgroundColor(color);
                }
                call.resolve(new JSObject());
            } catch (Exception exception) {
                call.reject("Could not update the native system-bar theme.", exception);
            }
        });
    }
}
