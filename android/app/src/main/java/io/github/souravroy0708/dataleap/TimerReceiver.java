package io.github.souravroy0708.dataleap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The running timer reached today's target. */
public class TimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String track = Store.get(c, "timerTrack", "sd");
        if (Scheduler.ACTION_CAP.equals(intent.getAction())) {
            // The longest session ended: stop the live timer. The app saves the session the next time it opens.
            String mins = Store.get(c, "timerCapMin", "30");
            Notifier.cancelTimer(c);
            Notifier.simple(c, Notifier.ID_TARGET, Notifier.CH_WIN, "Session saved: " + mins + " minutes",
                ("dsa".equals(track) ? "DSA" : "System design") + " timer stopped by itself, so a forgotten timer never inflates your hours. Open DataLeap to mark how it went.\n\n\u201C" + Store.quote(c, "family") + "\u201D");
            return;
        }
        String label = "dsa".equals(track) ? "DSA" : "System design";
        Notifier.simple(c, Notifier.ID_TARGET, Notifier.CH_REMIND, "Target reached",
            label + ": today's target is done. Open DataLeap to stop and log it, or keep going.\n\n\u201C" + Store.quote(c, "family") + "\u201D");
    }
}
