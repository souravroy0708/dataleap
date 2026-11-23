package io.github.souravroy0708.dataleap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;

/** Notification channels and builders. */
final class Notifier {
    static final String CH_REMIND = "reminders";
    static final String CH_TIMER = "timer";
    static final String CH_WIN = "celebrations";
    static final String CH_MOTIV = "motivation";
    static final int ID_REMIND = 10;
    static final int ID_TIMER = 20;
    static final int ID_TARGET = 21;
    static final int ID_WIN = 30;
    static final int ID_MOTIV = 40;
    static final int ID_WEEK = 41;
    private static final int HALDI = 0xFFFFC21A;

    private Notifier() {}

    static NotificationManager nm(Context c) { return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); }

    static void ensureChannels(Context c) {
        NotificationManager m = nm(c);
        NotificationChannel r = new NotificationChannel(CH_REMIND, "Practice reminders", NotificationManager.IMPORTANCE_HIGH);
        r.setDescription("Daily system design and DSA reminders, with a line to keep you going");
        m.createNotificationChannel(r);
        NotificationChannel t = new NotificationChannel(CH_TIMER, "Running timer", NotificationManager.IMPORTANCE_LOW);
        t.setDescription("Shows the practice timer while it runs");
        t.setShowBadge(false);
        m.createNotificationChannel(t);
        NotificationChannel w = new NotificationChannel(CH_WIN, "Streaks and levels", NotificationManager.IMPORTANCE_DEFAULT);
        w.setDescription("Streak milestones, level-ups and completed days");
        m.createNotificationChannel(w);
        NotificationChannel mo = new NotificationChannel(CH_MOTIV, "Morning motivation", NotificationManager.IMPORTANCE_DEFAULT);
        mo.setDescription("3 to 4 motivating notifications a day between 6 am and 2 pm, and a weekly summary on Sunday");
        m.createNotificationChannel(mo);
    }

    static void motivation(Context c, String title, String body, String track) {
        ensureChannels(c);
        Icon ic = Icon.createWithResource(c, R.drawable.ic_stat_dataleap);
        Notification n = base(c, CH_MOTIV, title, body)
            .setContentIntent(openApp(c, null, 6))
            .setAutoCancel(true)
            .addAction(new Notification.Action.Builder(ic, "sd".equals(track) ? "Start system design" : "Start DSA", openApp(c, track, "sd".equals(track) ? 7 : 8)).build())
            .build();
        nm(c).notify(ID_MOTIV, n);
    }

    static PendingIntent openApp(Context c, String start, int code) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (start != null) i.putExtra("start", start);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static Notification.Builder base(Context c, String channel, String title, String body) {
        return new Notification.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_stat_dataleap)
            .setColor(HALDI)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body));
    }

    static void reminder(Context c, String title, String body, String track, String reminderId) {
        ensureChannels(c);
        Intent snooze = new Intent(c, ActionReceiver.class).setAction(ActionReceiver.ACTION_SNOOZE).putExtra("id", reminderId);
        PendingIntent snoozePi = PendingIntent.getBroadcast(c, 501, snooze, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Icon ic = Icon.createWithResource(c, R.drawable.ic_stat_dataleap);
        Notification n = base(c, CH_REMIND, title, body)
            .setContentIntent(openApp(c, null, 1))
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .addAction(new Notification.Action.Builder(ic, "sd".equals(track) ? "Start system design" : "Start DSA", openApp(c, track, "sd".equals(track) ? 2 : 3)).build())
            .addAction(new Notification.Action.Builder(ic, "Snooze 30 min", snoozePi).build())
            .build();
        nm(c).notify(ID_REMIND, n);
    }

    static void timer(Context c, String title, String text, long startMs, boolean running) {
        ensureChannels(c);
        Notification.Builder b = base(c, CH_TIMER, title, text)
            .setContentIntent(openApp(c, null, 4))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STOPWATCH);
        if (running) b.setUsesChronometer(true).setWhen(startMs).setShowWhen(true);
        else b.setShowWhen(false);
        nm(c).notify(ID_TIMER, b.build());
    }

    static void cancelTimer(Context c) { nm(c).cancel(ID_TIMER); }

    /** Family and sleep reminders: no study buttons on purpose. */
    static void life(Context c, String title, String body, String id) {
        ensureChannels(c);
        Notification n = base(c, CH_MOTIV, title, body).setContentIntent(openApp(c, null, 11)).setAutoCancel(true).build();
        nm(c).notify(ID_REMIND + 1 + Math.abs(id.hashCode() % 5), n);
    }

    /** Sunday summary: tapping it opens the weekly retrospective. */
    static void weekly(Context c, String title, String body) {
        ensureChannels(c);
        Icon ic = Icon.createWithResource(c, R.drawable.ic_stat_dataleap);
        Notification n = base(c, CH_MOTIV, title, body)
            .setContentIntent(openApp(c, "retro", 9))
            .setAutoCancel(true)
            .addAction(new Notification.Action.Builder(ic, "Start retrospective", openApp(c, "retro", 10)).build())
            .build();
        nm(c).notify(ID_WEEK, n);
    }

    static void simple(Context c, int id, String channel, String title, String body) {
        ensureChannels(c);
        Notification n = base(c, channel, title, body).setContentIntent(openApp(c, null, 5)).setAutoCancel(true).build();
        nm(c).notify(id, n);
    }
}
