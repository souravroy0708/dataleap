package io.github.souravroy0708.dataleap;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * DataLeap's database on the phone (SQLite, app-private storage). Nothing is sent anywhere.
 *  - state:     the latest copy of everything (sessions, notes, statuses, retros, plan, settings)
 *  - snapshots: one copy per day for the last 30 days, so any day can be restored
 */
final class DataStore extends SQLiteOpenHelper {
    private static final String NAME = "dataleap.db";
    private static final int VERSION = 1;
    private static final int KEEP_DAYS = 30;
    private static DataStore instance;

    static synchronized DataStore get(Context c) {
        if (instance == null) instance = new DataStore(c.getApplicationContext());
        return instance;
    }

    private DataStore(Context c) { super(c, NAME, null, VERSION); }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE snapshots (day TEXT PRIMARY KEY, json TEXT NOT NULL, created INTEGER NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldV, int newV) {
        // Future schema changes go here as explicit migrations. Never drop user data.
    }

    synchronized void save(String json) {
        long now = System.currentTimeMillis();
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues v = new ContentValues();
            v.put("id", 1); v.put("json", json); v.put("updated", now);
            db.insertWithOnConflict("state", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            ContentValues s = new ContentValues();
            s.put("day", day); s.put("json", json); s.put("created", now);
            db.insertWithOnConflict("snapshots", null, s, SQLiteDatabase.CONFLICT_REPLACE);
            db.execSQL("DELETE FROM snapshots WHERE day NOT IN (SELECT day FROM snapshots ORDER BY day DESC LIMIT " + KEEP_DAYS + ")");
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized String load() {
        Cursor c = getReadableDatabase().rawQuery("SELECT json FROM state WHERE id = 1", null);
        try { return c.moveToFirst() ? c.getString(0) : ""; } finally { c.close(); }
    }

    synchronized String info() {
        JSONObject o = new JSONObject();
        try {
            Cursor c = getReadableDatabase().rawQuery("SELECT updated, length(json) FROM state WHERE id = 1", null);
            try { if (c.moveToFirst()) { o.put("updated", c.getLong(0)); o.put("bytes", c.getLong(1)); } } finally { c.close(); }
            JSONArray days = new JSONArray();
            Cursor s = getReadableDatabase().rawQuery("SELECT day, created, length(json) FROM snapshots ORDER BY day DESC", null);
            try {
                while (s.moveToNext()) {
                    JSONObject d = new JSONObject();
                    d.put("day", s.getString(0)); d.put("created", s.getLong(1)); d.put("bytes", s.getLong(2));
                    days.put(d);
                }
            } finally { s.close(); }
            o.put("snapshots", days);
        } catch (Exception ignored) {}
        return o.toString();
    }

    synchronized String snapshot(String day) {
        Cursor c = getReadableDatabase().rawQuery("SELECT json FROM snapshots WHERE day = ?", new String[]{day});
        try { return c.moveToFirst() ? c.getString(0) : ""; } finally { c.close(); }
    }
}
