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
        String name = t.optString("name");
        boolean comeback = t.optBoolean("missedYesterday");
        String[] cats = {"family", "switch", "sd", "dsa"};
        String cat = comeback && idx == 0 ? "comeback" : cats[idx % cats.length];
        String track = t.optBoolean("sdDone") || "dsa".equals(cat) ? "dsa" : "sd";
        String next = "sd".equals(track) ? t.optString("sdNext") : t.optString("dsaNext");
        int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String title;
        if (idx == 0 && hour < 10) title = name.length() > 0 ? "Good morning. This one is for " + name : "Good morning";
        else if (comeback) title = "Today is the comeback";
        else title = name.length() > 0 ? "For " + name : "DataLeap";
        StringBuilder body = new StringBuilder("\u201C").append(Store.quote(c, cat)).append("\u201D");
        if (next.length() > 0) body.append("\n\nToday's ").append("sd".equals(track) ? "system design" : "DSA").append(": ").append(next)
            .append(" (").append(t.optInt("minutes", 10)).append(" min counts)");
        Notifier.motivation(c, title, body.toString(), track);
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
