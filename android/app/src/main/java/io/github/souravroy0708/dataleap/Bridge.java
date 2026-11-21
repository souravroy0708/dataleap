package io.github.souravroy0708.dataleap;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Exposed to the web UI as window.AndroidBridge. */
final class Bridge {
    private final Activity a;

    Bridge(Activity a) { this.a = a; }

    @JavascriptInterface public String version() {
        try { return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    @JavascriptInterface public void setMotivation(String json) {
        Store.put(a, Motivation.K_CONFIG, json);
        Motivation.schedule(a);
    }

    @JavascriptInterface public void setReminders(String json) {
        Store.put(a, Store.K_REMINDERS, json);
        Scheduler.scheduleAll(a);
        Motivation.schedule(a);
    }

    @JavascriptInterface public void setDayState(String json) { Store.put(a, Store.K_DAY, json); }

    @JavascriptInterface public void setQuotes(String json) { Store.put(a, Store.K_QUOTES, json); }

    @JavascriptInterface public void notify(String title, String body) {
        Notifier.simple(a, Notifier.ID_WIN, Notifier.CH_WIN, title, body);
    }

    @JavascriptInterface public void testNotification() {
        try {
            org.json.JSONObject r = new org.json.JSONObject();
            r.put("id", "test"); r.put("focus", "sd"); r.put("msg", "Test reminder: this is how your reminders will look");
            Notifier.reminder(a, "DataLeap", r.getString("msg") + "\n\n\u201C" + Store.quote(a, "family") + "\u201D", "sd", "test");
        } catch (Exception ignored) {}
    }

    @JavascriptInterface public void timerStarted(String track, String title, long startMs, long goalAt) {
        Store.put(a, "timerTrack", track);
        String label = "dsa".equals(track) ? "DSA" : "System design";
        Notifier.timer(a, label + " timer running", title == null || title.isEmpty() ? "Tap to open DataLeap" : title, startMs, true);
        if (goalAt > System.currentTimeMillis()) Scheduler.timerTarget(a, goalAt); else Scheduler.cancelTimer(a);
    }

    @JavascriptInterface public void timerPaused(String track, String title) {
        String label = "dsa".equals(track) ? "DSA" : "System design";
        Notifier.timer(a, label + " timer paused", title == null || title.isEmpty() ? "Tap to resume" : title, 0, false);
        Scheduler.cancelTimer(a);
    }

    @JavascriptInterface public void timerStopped() {
        Notifier.cancelTimer(a);
        Scheduler.cancelTimer(a);
    }

    @JavascriptInterface public void openExternal(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
    }

    @JavascriptInterface public boolean notificationsEnabled() { return Notifier.nm(a).areNotificationsEnabled(); }

    @JavascriptInterface public boolean exactAlarms() { return Scheduler.canExact(a); }

    @JavascriptInterface public void openNotificationSettings() {
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
        a.startActivity(i);
    }

    @JavascriptInterface public void openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= 31) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + a.getPackageName()));
            a.startActivity(i);
        }
    }

    /** Saves text (backup JSON, calendar file) to Downloads/DataLeap. */
    @JavascriptInterface public boolean saveFile(String name, String mime, String content) {
        try {
            ContentResolver cr = a.getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/DataLeap");
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return false;
            OutputStream os = cr.openOutputStream(uri);
            os.write(content.getBytes(StandardCharsets.UTF_8));
            os.close();
            final String msg = "Saved to Downloads/DataLeap/" + name;
            a.runOnUiThread(new Runnable() { public void run() { Toast.makeText(a, msg, Toast.LENGTH_LONG).show(); } });
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
