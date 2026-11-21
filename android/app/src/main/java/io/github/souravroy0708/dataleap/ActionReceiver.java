package io.github.souravroy0708.dataleap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles notification actions that do not open the app. */
public class ActionReceiver extends BroadcastReceiver {
    static final String ACTION_SNOOZE = "io.github.souravroy0708.dataleap.SNOOZE";

    @Override
    public void onReceive(Context c, Intent intent) {
        if (ACTION_SNOOZE.equals(intent.getAction())) {
            Scheduler.snooze(c, intent.getStringExtra("id"), 30);
            Notifier.nm(c).cancel(Notifier.ID_REMIND);
        }
    }
}
