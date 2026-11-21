package io.github.souravroy0708.dataleap;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Automatic motivation: 3 to 4 notifications a day at varied times inside a window (default 06:00 to 14:00),
 * plus a weekly summary on Sunday evening. Only one alarm is pending at a time; each fire schedules the next.
 */
final class Motivation {
    static final String K_CONFIG = "motivation";
    static final String ACTION = "io.github.souravroy0708.dataleap.MOTIVATION";
    private static final int CODE_SLOT = 960;
    private static final int CODE_WEEK = 970;

    private Motivation() {}

    static JSONObject config(Context c) {
        try { return new JSONObject(Store.get(c, K_CONFIG, "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static boolean on(Context c) { return config(c).optBoolean("on", true); }

    private static PendingIntent pi(Context c, int code, String kind, int idx) {
        Intent i = new Intent(c, MotivationReceiver.class).setAction(ACTION);
        i.putExtra("kind", kind);
        i.putExtra("idx", idx);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Reminder times (minutes of day) to keep motivation slots away from. */
    private static int[] reminderMinutes(Context c) {
        JSONArray rs = Store.reminders(c);
        int[] out = new int[rs.length()];
        for (int k = 0; k < rs.length(); k++) out[k] = SchedulePlan.minutes(rs.optJSONObject(k) == null ? "" : rs.optJSONObject(k).optString("time"), -999);
        return out;
    }

    static int[] slotsFor(Context c, Calendar day) {
        JSONObject cfg = config(c);
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(day.getTime());
        return SchedulePlan.slots(date, cfg.optInt("count", 4),
            SchedulePlan.minutes(cfg.optString("start", "06:00"), 360),
            SchedulePlan.minutes(cfg.optString("end", "14:00"), 840),
            reminderMinutes(c));
    }

    static void schedule(Context c) {
        Scheduler.cancel(c, pi(c, CODE_SLOT, "slot", 0));
        Scheduler.cancel(c, pi(c, CODE_WEEK, "week", 0));
        if (!on(c)) return;
        long now = System.currentTimeMillis();
        Calendar day = Calendar.getInstance();
        for (int d = 0; d < 3; d++) {
            int[] s = slotsFor(c, day);
            for (int i = 0; i < s.length; i++) {
                Calendar t = (Calendar) day.clone();
                t.set(Calendar.HOUR_OF_DAY, s[i] / 60);
                t.set(Calendar.MINUTE, s[i] % 60);
                t.set(Calendar.SECOND, 0);
                t.set(Calendar.MILLISECOND, 0);
                if (t.getTimeInMillis() > now + 30_000) {
                    Scheduler.at(c, t.getTimeInMillis(), pi(c, CODE_SLOT, "slot", i), false);
                    d = 3;
                    break;
                }
            }
            day.add(Calendar.DAY_OF_MONTH, 1);
        }
        if (config(c).optBoolean("weekly", true)) {
            boolean[] sunday = {true, false, false, false, false, false, false};
            long w = SchedulePlan.nextAt(19, 0, sunday, now, TimeZone.getDefault());
            if (w > 0) Scheduler.at(c, w, pi(c, CODE_WEEK, "week", 0), false);
        }
    }

    static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()); }
}
