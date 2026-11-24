package io.github.souravroy0708.dataleap;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Random;

/** Small persisted state shared between the web UI (via Bridge) and the native alarms. */
final class Store {
    static final String PREFS = "dataleap";
    static final String K_REMINDERS = "reminders";
    static final String K_DAY = "day";
    static final String K_QUOTES = "quotes";
    private static final Random RNG = new Random();

    private Store() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String get(Context c, String k, String def) { return prefs(c).getString(k, def); }

    static void put(Context c, String k, String v) { prefs(c).edit().putString(k, v).apply(); }

    static JSONArray reminders(Context c) {
        try { return new JSONArray(get(c, K_REMINDERS, defaultReminders())); } catch (Exception e) { return new JSONArray(); }
    }

    static JSONObject day(Context c) {
        try { return new JSONObject(get(c, K_DAY, "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static int dayStartHour(Context c) { return day(c).optInt("dayStart", 4); }

    /** The study day, shifted by the day-start hour, as yyyy-MM-dd. */
    static String studyDate(Context c, long now) {
        long shifted = now - dayStartHour(c) * 3600_000L;
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(shifted));
    }

    static String yesterday(Context c, long now) { return studyDate(c, now - 24 * 3600_000L); }

    /** Today's state. If the app has not synced today, nothing is done yet. */
    static JSONObject today(Context c) {
        long now = System.currentTimeMillis();
        JSONObject d = day(c);
        String t = studyDate(c, now);
        JSONObject out = new JSONObject();
        try {
            boolean fresh = t.equals(d.optString("date"));
            out.put("sdDone", fresh && d.optBoolean("sdDone"));
            out.put("dsaDone", fresh && d.optBoolean("dsaDone"));
            out.put("status", fresh ? d.optString("status", "miss") : "miss");
            out.put("rest", fresh && d.optBoolean("rest"));
            out.put("sdNext", d.optString("sdNext", ""));
            out.put("dsaNext", d.optString("dsaNext", ""));
            out.put("minutes", d.optInt("min", 10));
            boolean missedYesterday;
            if (fresh) missedYesterday = d.optBoolean("missedYesterday");
            else if (yesterday(c, now).equals(d.optString("date"))) missedYesterday = !"ok".equals(d.optString("status")) && !d.optBoolean("rest");
            else missedYesterday = d.has("date");
            out.put("missedYesterday", missedYesterday);
            out.put("name", d.optString("name", ""));
        } catch (Exception ignored) {}
        return out;
    }

    /** Everything a notification needs to sound like it knows you. */
    static Persona.Ctx ctx(Context c, String salt) {
        JSONObject t = today(c);
        JSONObject d = day(c);
        Persona.Ctx x = new Persona.Ctx();
        x.me = d.optString("me", "");
        x.her = t.optString("name", "");
        x.pron = d.optString("pron", "they");
        x.self = d.optBoolean("self", false);
        x.workout = d.optString("workout", "");
        x.kgNow = d.optDouble("kgNow", 0);
        x.goalKg = d.optDouble("goalKg", 0);
        x.why = d.optString("why", "");
        x.plan = d.optString("plan", "");
        x.sdNext = t.optString("sdNext", "");
        x.dsaNext = t.optString("dsaNext", "");
        x.sleepAt = d.optString("sleepAt", "");
        x.sdAt = d.optString("sdAt", "");
        x.herAgeAtOffer = d.optString("herAgeAtOffer", "");
        x.status = t.optString("status", "miss");
        x.sdMin = d.optInt("sdMin", 10);
        x.dsaMin = d.optInt("dsaMin", 10);
        x.minCount = d.optInt("min", 5);
        x.streak = d.optInt("streak", 0);
        x.skipDays = d.optDouble("skipDays", -1);
        x.missedYesterday = t.optBoolean("missedYesterday");
        x.sdDone = t.optBoolean("sdDone");
        x.dsaDone = t.optBoolean("dsaDone");
        java.util.Calendar cal = java.util.Calendar.getInstance();
        x.hour = cal.get(java.util.Calendar.HOUR_OF_DAY);
        x.seed = cal.get(java.util.Calendar.DAY_OF_YEAR) * 7 + (salt == null ? 0 : Math.abs(salt.hashCode() % 97));
        String offer = d.optString("offerDate", "");
        if (offer.length() == 10) {
            try {
                long ms = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(offer).getTime() - System.currentTimeMillis();
                x.daysLeft = (int) Math.max(0, Math.ceil(ms / 86400000.0));
            } catch (Exception ignored) {}
        }
        return x;
    }

    static String quote(Context c, String category) {
        try {
            JSONObject q = new JSONObject(get(c, K_QUOTES, "{}"));
            JSONArray a = q.optJSONArray(category);
            if (a == null || a.length() == 0) a = q.optJSONArray("habit");
            if (a != null && a.length() > 0) return a.getString(RNG.nextInt(a.length()));
        } catch (Exception ignored) {}
        String[] fallback = {
            "The scroll will still be there tomorrow. This chance might not.",
            "Phone down. Timer on. Ten minutes wins the day.",
            "You are not studying for an interview. You are building the life your daughter grows up in."
        };
        return fallback[RNG.nextInt(fallback.length)];
    }

    static String defaultReminders() {
        return "[{\"id\":\"r1\",\"time\":\"07:00\",\"days\":[1,2,3,4,5],\"focus\":\"sd\",\"msg\":\"Before work: 10 minutes of system design\",\"skip\":true,\"last\":false,\"on\":true},"
            + "{\"id\":\"r2\",\"time\":\"13:30\",\"days\":[1,2,3,4,5],\"focus\":\"sd\",\"msg\":\"Lunch break: one system design video or summary\",\"skip\":true,\"last\":false,\"on\":true},"
            + "{\"id\":\"r3\",\"time\":\"21:00\",\"days\":[0,1,2,3,4,5,6],\"focus\":\"dsa\",\"msg\":\"DSA slot: one question\",\"skip\":true,\"last\":false,\"on\":true},"
            + "{\"id\":\"r4\",\"time\":\"22:15\",\"days\":[0,1,2,3,4,5,6],\"focus\":\"either\",\"msg\":\"Last call: the 10-minute version still counts\",\"skip\":true,\"last\":true,\"on\":true}]";
    }
}
