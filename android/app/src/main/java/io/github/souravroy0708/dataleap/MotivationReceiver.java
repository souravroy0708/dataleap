package io.github.souravroy0708.dataleap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

import java.util.Calendar;

/** Posts a motivation or weekly-summary notification, then schedules the next one. */
public class MotivationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        try {
            if ("week".equals(intent.getStringExtra("kind"))) weekly(c);
            else slot(c, intent.getIntExtra("idx", 0));
        } catch (Exception ignored) {
        } finally {
            Motivation.schedule(c);
        }
    }

    private static void slot(Context c, int idx) {
        JSONObject t = Store.today(c);
        if ("ok".equals(t.optString("status")) || t.optBoolean("rest")) return;
        Persona.Ctx x = Store.ctx(c, "slot" + idx);
        String[] cats = {"family", "switch", "sd", "dsa"};
        String cat = x.missedYesterday && idx == 0 ? "comeback" : cats[idx % cats.length];
        String[] n = Persona.motivation(x, idx, Store.quote(c, cat));
        Notifier.motivation(c, n[0], n[1], x.sdDone ? "dsa" : "sd");
    }

    private static void weekly(Context c) {
        JSONObject d = Store.day(c);
        int mins = d.optInt("weekMin", 0), complete = d.optInt("weekComplete", 0), streak = d.optInt("streak", 0);
        String hours = mins >= 60 ? String.format(java.util.Locale.US, "%.1f h", mins / 60.0) : mins + " min";
        String head = complete >= 5 ? "A strong week." : complete >= 3 ? "A solid week. Push for 5 complete days next week." : "A hard week. Next week starts with 10 minutes tomorrow.";
        String body = "This week: " + hours + " of practice, " + complete + " of 7 days complete, streak " + streak + ".\n" + head +
            "\n\n\u201C" + Store.quote(c, complete >= 5 ? "family" : "comeback") + "\u201D";
        Notifier.simple(c, Notifier.ID_WEEK, Notifier.CH_MOTIV, "Your week in DataLeap", body);
    }
}
