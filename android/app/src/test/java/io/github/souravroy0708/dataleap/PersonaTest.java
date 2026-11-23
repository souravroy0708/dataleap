package io.github.souravroy0708.dataleap;

/** Plain-JVM checks: every notification reads well, with and without personal details. */
public final class PersonaTest {
    private static int fails = 0;
    private static void check(boolean ok, String what) { System.out.println((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; }
    private static boolean clean(String[] n) {
        String all = n[0] + "\n" + n[1];
        return !all.contains("{") && !all.contains("null") && !all.contains("  ") && !all.contains("\u201C\u201D") && !all.trim().isEmpty() && !all.contains(" .") && !all.contains(",,");
    }
    public static void main(String[] a) {
        Persona.Ctx full = new Persona.Ctx();
        full.me = "Sourav"; full.her = "Ananya"; full.why = "So Ananya grows up with every door open"; full.plan = "20 minutes of system design at 7 am";
        full.sdNext = "Windows, watermarks and allowed lateness"; full.dsaNext = "Merge Intervals"; full.sleepAt = "12:30 am"; full.sdAt = "8:45 am";
        full.herAgeAtOffer = "3\u00BD"; full.sdMin = 30; full.dsaMin = 25; full.minCount = 15; full.daysLeft = 311; full.streak = 6; full.skipDays = 1.2; full.hour = 8;
        Persona.Ctx empty = new Persona.Ctx();
        System.out.println("Every notification type, with and without personal details");
        for (Persona.Ctx c : new Persona.Ctx[]{full, empty}) {
            String who = c == full ? "personal" : "empty   ";
            for (int seed = 0; seed < 14; seed++) {
                c.seed = seed;
                for (String k : new String[]{"sd", "dsa", "either", "last"}) {
                    String[] n = Persona.study(c, k, "", "Small and daily beats big and someday.");
                    if (!clean(n)) check(false, who + " study " + k + " seed " + seed + ": " + n[0] + " | " + n[1]);
                }
                for (int i = 0; i < 4; i++) if (!clean(Persona.motivation(c, i, "Show up first."))) check(false, who + " motivation " + i);
            }
            check(clean(Persona.night(c)) && clean(Persona.late(c, "1:10 am")) && clean(Persona.sleep(c)) && clean(Persona.family(c, true, "q")) && clean(Persona.family(c, false, "")), who + ": night, late, sleep and family read cleanly");
        }
        full.seed = 0;
        String[] sd = Persona.study(full, "sd", "", "q");
        check(sd[0].contains("Sourav") && sd[1].contains("Windows, watermarks") && sd[1].contains("30 min"), "system design reminder names you, today's item and its minutes");
        StringBuilder hooks = new StringBuilder();
        for (int s = 0; s < 7; s++) { full.seed = s; hooks.append(Persona.hook(full)).append('\n'); }
        String h = hooks.toString();
        check(h.contains("311 days") && h.contains("6-day streak") && h.contains("about 1\u00BD days later") == false && h.contains("about 1 day later") && h.contains("Your why") && h.contains("Your plan from the retro") && h.contains("about 3\u00BD"),
              "the personal hook rotates through offer countdown, streak, cost of skipping, your why, your retro plan and her age");
        full.missedYesterday = true; full.seed = 0;
        check(Persona.hook(full).contains("Never twice"), "after a missed day the first hook is the comeback");
        check(Persona.late(full, "1:10 am")[1].contains("Ananya") && Persona.night(full)[1].contains("12:30 am"), "night messages use her name and your bedtime");
        check(Persona.days(0.3).equals("\u00BD day") && Persona.days(1.2).equals("1 day") && Persona.days(2.6).equals("2\u00BD days"), "cost-of-skipping days are rounded to halves");
        System.out.println("\nSample morning reminder:\n" + Persona.study(full, "sd", "", "Your years of production fires are your edge.")[0] + "\n" + Persona.study(full, "sd", "", "Your years of production fires are your edge.")[1]);
        full.missedYesterday = false;
        String[] nt = Persona.night(full); System.out.println("\nSample after-office notification:\n" + nt[0] + "\n" + nt[1]);
        String[] lt = Persona.late(full, "1:10 am"); System.out.println("\nSample silent late-night check:\n" + lt[0] + "\n" + lt[1]);
        System.out.println(fails == 0 ? "\nAll persona checks passed" : fails + " persona check(s) failed");
        if (fails > 0) System.exit(1);
    }
}
