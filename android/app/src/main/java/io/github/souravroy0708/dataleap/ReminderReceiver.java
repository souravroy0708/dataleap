package io.github.souravroy0708.dataleap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/** Fires a reminder, unless today's work already makes it unnecessary, then schedules the next one. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        try {
            String id = intent.getStringExtra("id");
            JSONArray rs = Store.reminders(c);
            JSONObject r = null;
            for (int k = 0; k < rs.length(); k++) if (rs.getJSONObject(k).optString("id").equals(id)) r = rs.getJSONObject(k);
            if (r != null) fire(c, r);
        } catch (Exception ignored) {
        } finally {
            if (!intent.getBooleanExtra("snooze", false)) Scheduler.scheduleAll(c);
        }
    }

    static void fire(Context c, JSONObject r) {
        JSONObject t = Store.today(c);
        String status = t.optString("status");
        boolean sdDone = t.optBoolean("sdDone"), dsaDone = t.optBoolean("dsaDone");
        if (t.optBoolean("rest") || "ok".equals(status)) return;
        String focus = r.optString("focus", "either");
        if (r.optBoolean("skip", true) && (("dsa".equals(focus) && dsaDone) || ("sd".equals(focus) && sdDone))) return;
        String track = "either".equals(focus) ? (sdDone ? "dsa" : "sd") : focus;
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String cat = t.optBoolean("missedYesterday") ? "comeback" : (hour >= 20 ? "family" : track);
        String next = "sd".equals(track) ? t.optString("sdNext") : t.optString("dsaNext");
        String name = t.optString("name");
        String title = r.optBoolean("last") ? "Last call" : (name.length() > 0 ? "For " + name : "DataLeap");
        StringBuilder body = new StringBuilder(r.optString("msg", "Time to practise"));
        if (next.length() > 0) body.append("\nToday: ").append(next);
        if ("part".equals(status)) body.append("\nOne task left today.");
        body.append("\n\n\u201C").append(Store.quote(c, cat)).append("\u201D");
        Notifier.reminder(c, title, body.toString(), track, r.optString("id"));
    }
}
