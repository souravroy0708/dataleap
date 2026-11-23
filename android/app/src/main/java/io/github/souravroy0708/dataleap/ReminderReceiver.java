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
        String focus = r.optString("focus", "either");
        String id = r.optString("id");
        Persona.Ctx x = Store.ctx(c, id);
        // Life reminders always fire: family time and sleep are part of the plan, not a reward for finishing it.
        if ("family".equals(focus)) {
            String[] n = Persona.family(x, x.hour < 10, Store.quote(c, "family"));
            Notifier.life(c, n[0], n[1], id);
            return;
        }
        if ("sleep".equals(focus)) { String[] n = Persona.sleep(x); Notifier.life(c, n[0], n[1], id); return; }
        if ("night".equals(focus)) { String[] n = Persona.night(x); Notifier.life(c, n[0], n[1], id); return; }
        if ("late".equals(focus)) {
            String clock = new java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(new java.util.Date()).toLowerCase(java.util.Locale.US);
            String[] n = Persona.late(x, clock);
            Notifier.quiet(c, n[0], n[1]);
            return;
        }
        String status = t.optString("status");
        boolean sdDone = t.optBoolean("sdDone"), dsaDone = t.optBoolean("dsaDone");
        if (t.optBoolean("rest") || "ok".equals(status)) return;
        if (r.optBoolean("skip", true) && (("dsa".equals(focus) && dsaDone) || ("sd".equals(focus) && sdDone))) return;
        String track = "either".equals(focus) ? (sdDone ? "dsa" : "sd") : focus;
        String cat = x.missedYesterday ? "comeback" : (x.hour >= 20 ? "family" : track);
        String kind = r.optBoolean("last") ? "last" : focus;
        String[] n = Persona.study(x, kind, r.optString("msg", ""), Store.quote(c, cat));
        Notifier.reminder(c, n[0], n[1], track, id);
    }
}
