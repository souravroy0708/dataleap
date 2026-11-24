package io.github.souravroy0708.dataleap;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Home-screen widget: streak, today's two tasks, the next item and days to the offer. */
public class WidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { render(c, m, ids); }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
        if (ids != null && ids.length > 0) render(c, m, ids);
    }

    private static void render(Context c, AppWidgetManager m, int[] ids) {
        JSONObject t = Store.today(c);
        Persona.Ctx x = Store.ctx(c, "widget");
        int streak = Store.day(c).optInt("streak", 0);
        boolean sd = t.optBoolean("sdDone"), dsa = t.optBoolean("dsaDone");
        String status = t.optString("status");
        String head = "ok".equals(status) ? "Today complete" : streak > 0 ? streak + "-day streak" : "Day one";
        String today = "System design " + (sd ? "\u2713" : "\u25CB") + "   DSA " + (dsa ? "\u2713" : "\u25CB");
        String next = "ok".equals(status) ? "Done. Rest well." : (!sd ? (x.sdNext.isEmpty() ? "Next: system design" : "Next: " + x.sdNext) : (x.dsaNext.isEmpty() ? "Next: one DSA question" : "Next: " + x.dsaNext));
        String days = x.daysLeft >= 0 ? x.daysLeft + " days to your offer" : "";
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
            v.setTextViewText(R.id.w_streak, ("ok".equals(status) ? "\u2714 " : "\uD83D\uDD25 ") + head);
            v.setTextViewText(R.id.w_today, today);
            v.setTextViewText(R.id.w_next, next);
            v.setTextViewText(R.id.w_days, days);
            PendingIntent open = Notifier.openApp(c, null, 20);
            PendingIntent start = Notifier.openApp(c, sd ? "dsa" : "sd", 21);
            v.setOnClickPendingIntent(R.id.w_root, open);
            v.setOnClickPendingIntent(R.id.w_start, start);
            v.setTextViewText(R.id.w_start, "ok".equals(status) ? "Open" : "Start");
            m.updateAppWidget(id, v);
        }
    }
}
