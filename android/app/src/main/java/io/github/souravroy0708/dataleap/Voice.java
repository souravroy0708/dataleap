package io.github.souravroy0708.dataleap;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Voice entry for every text box, ported from Kharcha Check's VoiceInput.kt.
 * The web UI draws the sheets; this class runs Android's speech recogniser and reports what happens.
 * Privacy: the mic is asked for only when the user taps a mic, it is on only while the listening sheet is open,
 * audio is never saved or uploaded by DataLeap, and only the recognised words reach the app.
 */
final class Voice {
    static final int REQ_MIC = 44;
    static final int REQ_SCREEN = 45;
    private static final String GOOGLE_APP = "com.google.android.googlequicksearchbox";

    private final MainActivity a;
    private SpeechRecognizer rec;
    private boolean finished;
    private int attempt;
    private String partial = "";
    private String prompt = "Speak now";
    private long lastLevel;

    Voice(MainActivity a) { this.a = a; }

    // ---------- checks ----------
    static boolean hasMic(Context c) { return c.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED; }

    static boolean serviceAvailable(Context c) {
        try { return SpeechRecognizer.isRecognitionAvailable(c); } catch (Exception e) { return false; }
    }

    static boolean onDeviceAvailable(Context c) {
        if (Build.VERSION.SDK_INT < 31) return false;
        try { return SpeechRecognizer.isOnDeviceRecognitionAvailable(c); } catch (Exception e) { return false; }
    }

    /** The app that actually turns speech into text (usually "Google"). It needs its OWN mic permission too. */
    static JSONObject speechService(Context c) {
        try {
            PackageManager pm = c.getPackageManager();
            String pkg = null;
            String def = Settings.Secure.getString(c.getContentResolver(), "voice_recognition_service");
            if (def != null && def.length() > 0) {
                ComponentName cn = ComponentName.unflattenFromString(def);
                if (cn != null) pkg = cn.getPackageName();
            }
            if (pkg == null) {
                List<ResolveInfo> list = pm.queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
                List<String> installed = new ArrayList<String>();
                for (ResolveInfo r : list) installed.add(r.serviceInfo.packageName);
                if (installed.contains(GOOGLE_APP)) pkg = GOOGLE_APP;
                else if (!installed.isEmpty()) pkg = installed.get(0);
            }
            if (pkg == null) return null;
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            String label = String.valueOf(pm.getApplicationLabel(info));
            JSONObject o = new JSONObject();
            o.put("pkg", pkg);
            o.put("label", label.trim().isEmpty() ? "Google" : label);
            o.put("enabled", info.enabled);
            o.put("hasMic", pm.checkPermission(Manifest.permission.RECORD_AUDIO, pkg) == PackageManager.PERMISSION_GRANTED);
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    String status() {
        JSONObject o = new JSONObject();
        try {
            o.put("hasMic", hasMic(a));
            o.put("available", serviceAvailable(a));
            o.put("onDevice", onDeviceAvailable(a));
            JSONObject s = speechService(a);
            o.put("service", s == null ? JSONObject.NULL : s);
        } catch (Exception ignored) {}
        return o.toString();
    }

    // ---------- permission ----------
    void requestMic() { a.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); }

    void onPermissionResult(boolean granted) {
        JSONObject e = new JSONObject();
        try {
            e.put("type", "perm");
            e.put("granted", granted);
            // Android stops showing its dialog after two "Don't allow" taps: then only Settings can turn it on.
            e.put("canAskAgain", a.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO));
        } catch (Exception ignored) {}
        emit(e);
    }

    // ---------- listening ----------
    static Intent recognizerIntent(Context c, String prompt) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        // Indian English handles Indian names, accents and everyday Hinglish.
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, c.getPackageName());
        return i;
    }

    void start(String p) {
        prompt = p == null || p.isEmpty() ? "Speak now" : p;
        destroy();
        // Attempt 0 prefers the on-device recogniser (nothing leaves the phone); attempt 1 uses the phone's standard one.
        attempt = onDeviceAvailable(a) ? 0 : 1;
        begin();
    }

    private void begin() {
        final boolean onDevice = attempt == 0;
        partial = "";
        finished = false;
        try {
            rec = (onDevice && Build.VERSION.SDK_INT >= 31) ? SpeechRecognizer.createOnDeviceSpeechRecognizer(a) : SpeechRecognizer.createSpeechRecognizer(a);
        } catch (Exception e) {
            rec = null;
        }
        if (rec == null) {
            if (onDevice) { attempt = 1; begin(); } else error(SpeechRecognizer.ERROR_CLIENT, false);
            return;
        }
        rec.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle params) { event("ready", null); }
            public void onBeginningOfSpeech() { event("ready", null); }
            public void onRmsChanged(float rms) {
                long now = System.currentTimeMillis();
                if (now - lastLevel < 90) return;
                lastLevel = now;
                float v = Math.max(0f, Math.min(1f, (rms + 2f) / 12f));
                JSONObject e = new JSONObject();
                try { e.put("type", "level"); e.put("v", v); } catch (Exception ignored) {}
                emit(e);
            }
            public void onBufferReceived(byte[] buffer) {}
            public void onEndOfSpeech() {}
            public void onPartialResults(Bundle b) {
                String t = first(b);
                if (t != null && !t.trim().isEmpty()) { partial = t; event("partial", t); }
            }
            public void onEvent(int type, Bundle params) {}
            public void onResults(Bundle b) {
                if (finished) return;
                finished = true;
                String t = first(b);
                if (t == null || t.trim().isEmpty()) t = partial.trim();
                if (!t.isEmpty()) result(t); else error(SpeechRecognizer.ERROR_NO_MATCH, onDevice);
                destroy();
            }
            public void onError(int err) {
                if (finished) return;
                // The on-device recogniser may not have English (India) yet: quietly fall back to the standard one.
                if (onDevice && err != SpeechRecognizer.ERROR_NO_MATCH && err != SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                    && err != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                    finished = true; destroy(); attempt = 1; begin(); return;
                }
                finished = true;
                if (!partial.trim().isEmpty() && (err == SpeechRecognizer.ERROR_NO_MATCH || err == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) result(partial.trim());
                else error(err, onDevice);
                destroy();
            }
        });
        try {
            rec.startListening(recognizerIntent(a, prompt));
        } catch (Exception e) {
            finished = true;
            destroy();
            if (onDevice) { attempt = 1; begin(); } else error(SpeechRecognizer.ERROR_CLIENT, false);
        }
    }

    void stop() { try { if (rec != null) rec.stopListening(); } catch (Exception ignored) {} }

    void cancel() { finished = true; destroy(); }

    private void destroy() {
        if (rec != null) {
            try { rec.cancel(); } catch (Exception ignored) {}
            try { rec.destroy(); } catch (Exception ignored) {}
            rec = null;
        }
    }

    /** Google's own voice screen, offered only as a fallback. */
    void googleScreen(String p) {
        try { a.startActivityForResult(recognizerIntent(a, p == null ? prompt : p), REQ_SCREEN); }
        catch (Exception e) { error(SpeechRecognizer.ERROR_CLIENT, false); }
    }

    void onScreenResult(int resultCode, Intent data) {
        if (resultCode != MainActivity.RESULT_OK || data == null) { event("cancel", null); return; }
        ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (r != null && !r.isEmpty() && !r.get(0).trim().isEmpty()) result(r.get(0).trim()); else event("cancel", null);
    }

    // ---------- fixes ----------
    static void openAppSettings(Context c, String pkg) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", pkg == null || pkg.isEmpty() ? c.getPackageName() : pkg, null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { c.startActivity(i); } catch (Exception ignored) {}
    }

    /** "Speech Recognition & Synthesis from Google" provides voice typing on most Android phones. */
    static void openSpeechStore(Context c) {
        String id = "com.google.android.tts";
        try { c.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + id)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (Exception e) {
            try { c.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + id)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
        }
    }

    static void openVoiceSettings(Context c) {
        String[] actions = {Settings.ACTION_VOICE_INPUT_SETTINGS, Settings.ACTION_INPUT_METHOD_SETTINGS, Settings.ACTION_SETTINGS};
        for (String s : actions) {
            try { c.startActivity(new Intent(s).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return; } catch (Exception ignored) {}
        }
    }

    // ---------- events to the web UI ----------
    private static String first(Bundle b) {
        if (b == null) return null;
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return r == null || r.isEmpty() ? null : r.get(0);
    }

    private void event(String type, String text) {
        JSONObject e = new JSONObject();
        try { e.put("type", type); if (text != null) e.put("text", text); } catch (Exception ignored) {}
        emit(e);
    }

    private void result(String text) { event("result", text); }

    private void error(int code, boolean onDevice) {
        JSONObject e = new JSONObject();
        try { e.put("type", "error"); e.put("code", code); e.put("onDevice", onDevice); } catch (Exception ignored) {}
        emit(e);
    }

    private void emit(final JSONObject e) { a.js("window.dlVoiceEvent && window.dlVoiceEvent(" + e.toString() + ")"); }
}
