package io.github.souravroy0708.dataleap;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.TimeZone;

/** Schedules reminder, snooze and timer alarms. Alarms are re-created after every fire, reboot and settings change. */
final class Scheduler {
    static final String ACTION_REMINDER = "io.github.souravroy0708.dataleap.REMINDER";
    static final String ACTION_TIMER = "io.github.souravroy0708.dataleap.TIMER_TARGET";
    private static final int BASE = 1000;
    private static final int MAX = 12;
    private static final int SNOOZE_CODE = 900;
    private static final int TIMER_CODE = 950;

    private Scheduler() {}

    private static AlarmManager am(Context c) { return (AlarmManager) c.getSystemService(Context.ALARM_SERVICE); }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return am(c).canScheduleExactAlarms();
    }

    private static void at(Context c, long when, PendingIntent pi) {
        AlarmManager a = am(c);
        if (canExact(c)) a.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        else a.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
    }

    private static PendingIntent reminderPi(Context c, int code, String id, boolean snooze) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION_REMINDER);
        i.putExtra("id", id);
        i.putExtra("snooze", snooze);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void scheduleAll(Context c) {
        for (int k = 0; k < MAX; k++) am(c).cancel(reminderPi(c, BASE + k, "", false));
        JSONArray rs = Store.reminders(c);
        long now = System.currentTimeMillis();
        for (int k = 0; k < rs.length() && k < MAX; k++) {
            JSONObject r = rs.optJSONObject(k);
            if (r == null || !r.optBoolean("on", true)) continue;
            long when = next(r, now);
            if (when > 0) at(c, when, reminderPi(c, BASE + k, r.optString("id"), false));
        }
    }

    static void snooze(Context c, String id, int minutes) {
        at(c, System.currentTimeMillis() + minutes * 60_000L, reminderPi(c, SNOOZE_CODE, id, true));
    }

    /** Next time this reminder should fire, strictly after now. */
    static long next(JSONObject r, long now) {
        int t = SchedulePlan.minutes(r.optString("time", "21:00"), 21 * 60);
        JSONArray days = r.optJSONArray("days");
        boolean[] on = new boolean[7];
        if (days == null || days.length() == 0) { for (int i = 0; i < 7; i++) on[i] = true; }
        else for (int i = 0; i < days.length(); i++) { int d = days.optInt(i, -1); if (d >= 0 && d < 7) on[d] = true; }
        return SchedulePlan.nextAt(t / 60, t % 60, on, now, TimeZone.getDefault());
    }

    static void at(Context c, long when, PendingIntent pi, boolean exact) {
        if (exact) at(c, when, pi); else am(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
    }

    static void cancel(Context c, PendingIntent pi) { am(c).cancel(pi); }

    private static PendingIntent timerPi(Context c) {
        Intent i = new Intent(c, TimerReceiver.class).setAction(ACTION_TIMER);
        return PendingIntent.getBroadcast(c, TIMER_CODE, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static final String ACTION_CAP = "io.github.souravroy0708.dataleap.TIMER_CAP";

    private static PendingIntent capPi(Context c) {
        Intent i = new Intent(c, TimerReceiver.class).setAction(ACTION_CAP);
        return PendingIntent.getBroadcast(c, TIMER_CODE + 1, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void timerTarget(Context c, long when) { at(c, when, timerPi(c)); }

    static void timerCap(Context c, long when) { at(c, when, capPi(c)); }

    static void cancelTimer(Context c) { am(c).cancel(timerPi(c)); am(c).cancel(capPi(c)); }
}
