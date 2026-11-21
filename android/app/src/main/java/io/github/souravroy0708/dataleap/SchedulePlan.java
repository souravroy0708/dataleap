package io.github.souravroy0708.dataleap;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Random;
import java.util.TimeZone;

/** Pure scheduling maths, no Android types, so it is unit-tested on the JVM (see SelfTest). */
final class SchedulePlan {
    private SchedulePlan() {}

    /** Next time h:m falls on an enabled weekday (0 = Sunday), strictly after now. -1 if no day is enabled. */
    static long nextAt(int h, int m, boolean[] on, long now, TimeZone tz) {
        Calendar cal = Calendar.getInstance(tz);
        cal.setTimeInMillis(now);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.set(Calendar.HOUR_OF_DAY, h);
        cal.set(Calendar.MINUTE, m);
        for (int i = 0; i < 8; i++) {
            int dow = cal.get(Calendar.DAY_OF_WEEK) - 1;
            if (on[dow] && cal.getTimeInMillis() > now + 1000) return cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return -1;
    }

    /**
     * Minutes of the day for one day's motivation notifications.
     * The window is split into equal segments with one slot at a varied time inside each, so they never bunch up.
     * The same date always gives the same times, so a reboot does not reshuffle the day.
     * Slots within 20 minutes of a reminder are moved later or dropped, so the two never stack.
     */
    static int[] slots(String date, int count, int startMin, int endMin, int[] avoid) {
        count = Math.max(1, Math.min(6, count));
        if (endMin <= startMin + 30) endMin = startMin + 30 * count;
        int seg = (endMin - startMin) / count;
        Random r = new Random(date.hashCode() * 31L + count * 7L + startMin);
        List<Integer> out = new ArrayList<Integer>();
        for (int i = 0; i < count; i++) {
            int segStart = startMin + i * seg, segEnd = Math.min(endMin - 5, startMin + (i + 1) * seg);
            int pad = Math.min(10, seg / 4);
            int lo = segStart + pad, hi = segEnd - pad;
            int t = hi > lo ? lo + r.nextInt(hi - lo + 1) : (lo + hi) / 2;
            t -= t % 5;
            int prev = out.isEmpty() ? -999 : out.get(out.size() - 1);
            int[] tries = {0, 25, -25, 40, -40, 55, -55};
            int pick = -1;
            for (int d : tries) {
                int c = t + d;
                if (c < segStart || c > segEnd || c < startMin || c >= endMin) continue;
                if (near(c, avoid) || c - prev < 20) continue;
                pick = c;
                break;
            }
            if (pick >= 0) out.add(pick);
        }
        int[] a = new int[out.size()];
        for (int i = 0; i < a.length; i++) a[i] = out.get(i);
        return a;
    }

    private static boolean near(int t, int[] avoid) {
        if (avoid == null) return false;
        for (int x : avoid) if (Math.abs(x - t) < 20) return true;
        return false;
    }

    static int minutes(String hhmm, int def) {
        try {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return def;
        }
    }
}
