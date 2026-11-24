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
        full.me = "Arjun"; full.her = "Riya"; full.why = "So Riya grows up with every door open"; full.plan = "20 minutes of system design at 7 am";
        full.sdNext = "Windows, watermarks and allowed lateness"; full.dsaNext = "Merge Intervals"; full.sleepAt = "12:30 am"; full.sdAt = "8:45 am";
        full.herAgeAtOffer = "3\u00BD"; full.sdMin = 30; full.dsaMin = 25; full.minCount = 15; full.daysLeft = 311; full.streak = 6; full.skipDays = 1.2; full.hour = 8;
        full.pron = "she";
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
        check(sd[0].contains("Arjun") && sd[1].contains("Windows, watermarks") && sd[1].contains("30 min"), "system design reminder names you, today's item and its minutes");
        StringBuilder hooks = new StringBuilder();
        for (int s = 0; s < 7; s++) { full.seed = s; hooks.append(Persona.hook(full)).append('\n'); }
        String h = hooks.toString();
        check(h.contains("311 days") && h.contains("6-day streak") && h.contains("about 1\u00BD days later") == false && h.contains("about 1 day later") && h.contains("Your why") && h.contains("Your plan from the retro") && h.contains("about 3\u00BD"),
              "the personal hook rotates through offer countdown, streak, cost of skipping, your why, your retro plan and her age");
        full.missedYesterday = true; full.seed = 0;
        check(Persona.hook(full).contains("Never twice"), "after a missed day the first hook is the comeback");
        check(Persona.late(full, "1:10 am")[1].contains("Riya") && Persona.night(full)[1].contains("12:30 am"), "night messages use her name and your bedtime");
        check(Persona.days(0.3).equals("\u00BD day") && Persona.days(1.2).equals("1 day") && Persona.days(2.6).equals("2\u00BD days"), "cost-of-skipping days are rounded to halves");
        System.out.println("Other people's setups");
        Persona.Ctx parents = new Persona.Ctx(); parents.her = "your parents"; parents.pron = "they"; parents.me = "Ravi"; parents.skipDays = 1; parents.sdAt = "6:45 am";
        Persona.Ctx mom = new Persona.Ctx(); mom.her = "Amma"; mom.pron = "she"; mom.skipDays = 1;
        Persona.Ctx self = new Persona.Ctx(); self.self = true; self.me = "Priya"; self.skipDays = 2;
        for (Persona.Ctx c : new Persona.Ctx[]{parents, mom, self}) for (int sv = 0; sv < 10; sv++) {
            c.seed = sv;
            String[][] all = {Persona.study(c, "sd", "", "q"), Persona.study(c, "last", "", ""), Persona.night(c), Persona.late(c, "12:10 am"), Persona.sleep(c), Persona.family(c, true, "q"), Persona.family(c, false, ""), Persona.motivation(c, 0, "q"), Persona.motivation(c, 2, "q")};
            for (String[] n : all) if (!clean(n)) check(false, c.her + "/" + c.self + ": " + n[0] + " | " + n[1]);
        }
        parents.seed = 1; String hp = ""; for (int s = 0; s < 6; s++) { parents.seed = s; hp += Persona.hook(parents) + "\n"; }
        check(hp.contains("your parents are a day closer"), "plural: \"your parents are a day closer\"");
        mom.seed = 0; String hm = ""; for (int s = 0; s < 6; s++) { mom.seed = s; hm += Persona.hook(mom) + "\n"; }
        check(hm.contains("Amma is a day closer"), "singular: \"Amma is a day closer\"");
        check(Persona.late(parents, "12:10 am")[1].contains("your parents need you rested") && Persona.late(mom, "12:10 am")[1].contains("Amma needs you rested"), "late check agrees: \"need\" vs \"needs\"");
        String sh = ""; for (int s = 0; s < 6; s++) { self.seed = s; sh += Persona.hook(self) + Persona.family(self, true, "")[1] + Persona.night(self)[1] + Persona.late(self, "1 am")[1]; }
        check(sh.contains("career you want") && !sh.contains("your family") && !sh.contains("daughter"), "doing it for yourself: no family wording at all");
        check(!Persona.motivation(self, 0, "q")[0].contains("This one is for"), "self: morning title is not dedicated to anyone else");
        Persona.Ctx g = new Persona.Ctx(); g.me = "Arjun"; g.her = "Riya"; g.pron = "she"; g.workout = "Strength A"; g.kgNow = 71.4; g.goalKg = 65;
        boolean gymOk = true; for (int s2 = 0; s2 < 8; s2++) { g.seed = s2; if (!clean(Persona.gym(g))) gymOk = false; }
        String[] gn = Persona.gym(g);
        check(gymOk && gn[1].contains("Strength A") && gn[1].contains("71.4 kg now, 65 kg") && gn[0].contains("Arjun"), "gym reminder names the workout and the weight goal");
        Persona.Ctx g2 = new Persona.Ctx(); g2.self = true; boolean g2ok = true; for (int s2 = 0; s2 < 8; s2++) { g2.seed = s2; if (!clean(Persona.gym(g2)) || Persona.gym(g2)[1].contains("family")) g2ok = false; }
        check(g2ok, "gym reminder without details or family reads cleanly");
        System.out.println("\nSample morning reminder:\n" + Persona.study(full, "sd", "", "Your years of production fires are your edge.")[0] + "\n" + Persona.study(full, "sd", "", "Your years of production fires are your edge.")[1]);
        full.missedYesterday = false;
        String[] nt = Persona.night(full); System.out.println("\nSample after-office notification:\n" + nt[0] + "\n" + nt[1]);
        String[] lt = Persona.late(full, "1:10 am"); System.out.println("\nSample silent late-night check:\n" + lt[0] + "\n" + lt[1]);
        System.out.println(fails == 0 ? "\nAll persona checks passed" : fails + " persona check(s) failed");
        if (fails > 0) System.exit(1);
    }
}
