package io.github.souravroy0708.dataleap;

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
    private final MainActivity a;

    Bridge(MainActivity a) { this.a = a; }

    private void ui(Runnable r) { a.runOnUiThread(r); }

    /** Android share sheet: WhatsApp, SMS, email. */
    @JavascriptInterface public void share(final String text) {
        ui(new Runnable() { public void run() {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            try { a.startActivity(Intent.createChooser(i, "Share your check-in")); } catch (Exception ignored) {}
        } });
    }

    // ---------- database on the phone ----------
    @JavascriptInterface public void dbSave(String json) { if (json != null && json.length() > 2) DataStore.get(a).save(json); }
    @JavascriptInterface public String dbLoad() { return DataStore.get(a).load(); }
    @JavascriptInterface public String dbInfo() { return DataStore.get(a).info(); }
    @JavascriptInterface public String dbSnapshot(String day) { return DataStore.get(a).snapshot(day); }

    // ---------- voice ----------
    @JavascriptInterface public String voiceStatus() { return a.voice.status(); }
    @JavascriptInterface public void voiceRequestMic() { ui(new Runnable() { public void run() { a.voice.requestMic(); } }); }
    @JavascriptInterface public void voiceStart(final String prompt) { ui(new Runnable() { public void run() { a.voice.start(prompt); } }); }
    @JavascriptInterface public void voiceStop() { ui(new Runnable() { public void run() { a.voice.stop(); } }); }
    @JavascriptInterface public void voiceCancel() { ui(new Runnable() { public void run() { a.voice.cancel(); } }); }
    @JavascriptInterface public void voiceGoogleScreen(final String prompt) { ui(new Runnable() { public void run() { a.voice.googleScreen(prompt); } }); }
    @JavascriptInterface public void openAppSettings(String pkg) { Voice.openAppSettings(a, pkg); }
    @JavascriptInterface public void openSpeechStore() { Voice.openSpeechStore(a); }
    @JavascriptInterface public void openVoiceSettings() { Voice.openVoiceSettings(a); }

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

    @JavascriptInterface public void timerStarted(String track, String title, long startMs, long goalAt, long capAt) {
        Store.put(a, "timerTrack", track);
        Store.put(a, "timerCapMin", String.valueOf(Math.max(1, (capAt - startMs) / 60000)));
        String label = "dsa".equals(track) ? "DSA" : "System design";
        String when = new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(new java.util.Date(capAt));
        Notifier.timer(a, label + " timer running", (title == null || title.isEmpty() ? "Tap to open DataLeap" : title) + "\nStops and saves by itself at " + when, startMs, true);
        Scheduler.cancelTimer(a);
        long now = System.currentTimeMillis();
        if (goalAt > now && goalAt < capAt) Scheduler.timerTarget(a, goalAt);
        if (capAt > now) Scheduler.timerCap(a, capAt);
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
