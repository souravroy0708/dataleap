package io.github.souravroy0708.dataleap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The running timer reached today's target. */
public class TimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String track = Store.get(c, "timerTrack", "sd");
        String label = "dsa".equals(track) ? "DSA" : "System design";
        Notifier.simple(c, Notifier.ID_TARGET, Notifier.CH_REMIND, "Target reached",
            label + ": today's target is done. Open DataLeap to stop and log it, or keep going.\n\n\u201C" + Store.quote(c, "family") + "\u201D");
    }
}
