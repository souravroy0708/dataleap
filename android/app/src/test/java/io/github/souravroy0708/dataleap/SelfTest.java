package io.github.souravroy0708.dataleap;

import java.util.Calendar;
import java.util.TimeZone;

/** Plain-JVM checks for the scheduling maths. Run: see .github/workflows/android-apk.yml ("Self-test"). */
public final class SelfTest {
    private static int fails = 0;

    private static void check(boolean ok, String what) {
        System.out.println((ok ? "  ok   " : "  FAIL ") + what);
        if (!ok) fails++;
    }

    private static long at(TimeZone tz, int y, int mo, int d, int h, int m) {
        Calendar c = Calendar.getInstance(tz);
        c.clear();
        c.set(y, mo - 1, d, h, m, 0);
        return c.getTimeInMillis();
    }

    public static void main(String[] args) {
        TimeZone ist = TimeZone.getTimeZone("Asia/Kolkata");
        boolean[] weekdays = {false, true, true, true, true, true, false};
        boolean[] all = {true, true, true, true, true, true, true};

        System.out.println("Reminder times");
        long fri2100 = at(ist, 2026, 11, 20, 21, 0);
        check(SchedulePlan.nextAt(7, 0, weekdays, at(ist, 2026, 11, 20, 6, 0), ist) == at(ist, 2026, 11, 20, 7, 0), "Friday 06:00 -> same day 07:00");
        check(SchedulePlan.nextAt(7, 0, weekdays, fri2100, ist) == at(ist, 2026, 11, 23, 7, 0), "Friday night, weekdays only -> Monday 07:00");
        check(SchedulePlan.nextAt(21, 0, all, fri2100, ist) == at(ist, 2026, 11, 21, 21, 0), "exactly at fire time -> tomorrow, never twice");
        check(SchedulePlan.nextAt(7, 0, new boolean[7], fri2100, ist) == -1, "no days enabled -> none");

        System.out.println("Motivation slots, 06:00 to 14:00");
        int[] avoid = {7 * 60, 13 * 60 + 30, 21 * 60, 22 * 60 + 15};
        int total = 0;
        for (int day = 1; day <= 60; day++) {
            String date = String.format("2026-12-%02d", (day % 28) + 1) + "-" + day;
            int[] s = SchedulePlan.slots(date, 4, 360, 840, avoid);
            total += s.length;
            boolean inWindow = true, spaced = true, clear = true;
            for (int i = 0; i < s.length; i++) {
                if (s[i] < 360 || s[i] >= 840) inWindow = false;
                if (i > 0 && s[i] - s[i - 1] < 20) spaced = false;
                for (int a : avoid) if (Math.abs(a - s[i]) < 20) clear = false;
            }
            if (!inWindow || !spaced || !clear || s.length < 3) {
                check(false, "day " + day + ": " + java.util.Arrays.toString(s));
            }
        }
        check(total >= 60 * 3, "60 days: always 3 or 4 a day, inside the window, 20+ min apart, clear of reminders (" + total + " total)");
        check(java.util.Arrays.equals(SchedulePlan.slots("2026-12-01", 4, 360, 840, avoid), SchedulePlan.slots("2026-12-01", 4, 360, 840, avoid)), "same date -> same times (stable after reboot)");
        check(!java.util.Arrays.equals(SchedulePlan.slots("2026-12-01", 4, 360, 840, null), SchedulePlan.slots("2026-12-02", 4, 360, 840, null)), "different dates -> different times (not predictable)");
        int[] three = SchedulePlan.slots("2026-12-03", 3, 360, 840, null);
        check(three.length == 3, "count 3 -> 3 slots " + java.util.Arrays.toString(three));
        check(SchedulePlan.minutes("06:30", 0) == 390 && SchedulePlan.minutes("bad", 7) == 7, "time parsing");

        System.out.println(fails == 0 ? "All checks passed" : fails + " check(s) failed");
        if (fails > 0) System.exit(1);
    }
}
