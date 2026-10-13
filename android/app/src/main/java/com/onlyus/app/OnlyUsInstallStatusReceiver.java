package com.onlyus.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class OnlyUsInstallStatusReceiver extends BroadcastReceiver {
    public static final String ACTION_INSTALL_STATUS = "com.onlyus.app.ACTION_INSTALL_STATUS";
    public static final String EXTRA_SESSION_ID = "onlyus_install_session_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        OnlyUsUpdatePlugin.handleInstallStatus(context, intent);
    }
}
