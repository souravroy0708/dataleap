package io.github.souravroy0708.dataleap;

import java.util.ArrayList;
import java.util.List;

/**
 * Every notification's words, personalised. Pure Java (no Android types) so SelfTest checks the texts on the JVM.
 * The rule: name the person, name today's exact work and its minutes, and say what skipping really costs.
 */
final class Persona {
    /** What the app knows about today, copied from the web UI's last sync. */
    static final class Ctx {
        String me = "", her = "", pron = "they", why = "", plan = "", sdNext = "", dsaNext = "", sleepAt = "", sdAt = "", herAgeAtOffer = "", status = "miss";
        int sdMin = 10, dsaMin = 10, minCount = 5, daysLeft = -1, streak = 0, hour = 9, seed = 0;
        double skipDays = -1;
        boolean missedYesterday, sdDone, dsaDone, self;

        /** Who you are doing this for: a name, or a phrase like "your parents". Empty when doing it for yourself. */
        String her() { return her.isEmpty() ? "your family" : her; }
        String Her() { String h = her(); return Character.toUpperCase(h.charAt(0)) + h.substring(1); }
        boolean plural() { return "they".equals(pron) || her.contains(" and ") || her.contains(","); }
        String s() { return plural() ? "" : "s"; }
        String isAre() { return plural() ? "are" : "is"; }
        String them() { return plural() ? "them" : "she".equals(pron) ? "her" : "he".equals(pron) ? "him" : "them"; }
        String meComma() { return me.isEmpty() ? "" : ", " + me; }
    }

    private Persona() {}

    static String pick(List<String> options, int seed) {
        List<String> ok = new ArrayList<String>();
        for (String o : options) if (o != null && !o.isEmpty()) ok.add(o);
        if (ok.isEmpty()) return "";
        return ok.get(Math.abs(seed) % ok.size());
    }

    static String days(double d) {
        if (d < 0) return "";
        double r = Math.max(0.5, Math.round(d * 2) / 2.0);
        int whole = (int) Math.floor(r);
        String n = r == whole ? String.valueOf(whole) : (whole == 0 ? "" : String.valueOf(whole)) + "\u00BD";
        return n + (r <= 1 ? " day" : " days");
    }

    /** One personal line that makes ignoring the notification feel like a choice, not an accident. */
    static String hook(Ctx c) {
        List<String> o = new ArrayList<String>();
        if (c.missedYesterday) o.add("Yesterday slipped. Never twice: today decides whether this is a habit or a phase.");
        if (c.skipDays >= 0) o.add("Skip today and your plan finishes about " + days(c.skipDays) + " later. Do it and " + (c.self ? "you are a day closer to the career you want." : c.her() + " " + c.isAre() + " a day closer to the life you are building."));
        if (c.daysLeft >= 0) o.add(c.daysLeft + " days to your offer date. Today is one of them.");
        if (c.streak >= 2) o.add(c.streak + "-day streak. Don't hand it back for a few minutes of scrolling.");
        if (!c.why.isEmpty()) o.add("Your why: \u201C" + c.why + "\u201D");
        if (!c.plan.isEmpty()) o.add("Your plan from the retro: \u201C" + c.plan + "\u201D");
        if (!c.herAgeAtOffer.isEmpty()) o.add(c.Her() + " will be about " + c.herAgeAtOffer + " when you start the new job. Build it now.");
        return pick(o, c.seed);
    }

    /** Study reminders. kind: sd, dsa, either, last. */
    static String[] study(Ctx c, String kind, String msg, String quote) {
        String track = "either".equals(kind) || "last".equals(kind) ? (c.sdDone ? "dsa" : "sd") : kind;
        boolean sd = "sd".equals(track);
        String item = sd ? c.sdNext : c.dsaNext;
        int mins = sd ? c.sdMin : c.dsaMin;
        String title;
        StringBuilder b = new StringBuilder();
        if ("last".equals(kind)) {
            title = "Last call" + c.meComma() + ": " + c.minCount + " minutes saves today";
            b.append("Office is done. ").append(c.minCount).append(" minutes on ").append(item.isEmpty() ? (sd ? "system design" : "one DSA question") : "\u201C" + item + "\u201D")
             .append(" completes the day. Then phone down").append(c.sleepAt.isEmpty() ? "" : ", sleep by " + c.sleepAt).append(".");
        } else if (sd) {
            title = (c.hour < 12 ? "Your sharpest hour starts now" : "System design, " + mins + " minutes") + c.meComma();
            b.append("Today: ").append(item.isEmpty() ? "one system design topic" : "\u201C" + item + "\u201D").append(", ").append(mins).append(" min. Phone face down, timer on.");
        } else {
            title = "One DSA question" + c.meComma();
            b.append("Today: ").append(item.isEmpty() ? "one data-engineering question" : "\u201C" + item + "\u201D").append(", ").append(mins).append(" min, out loud.");
        }
        if ("part".equals(c.status) && !"last".equals(kind)) b.append(" One task left today.");
        String h = hook(c);
        if (!h.isEmpty()) b.append("\n\n").append(h);
        if (quote != null && !quote.isEmpty()) b.append("\n\n\u201C").append(quote).append("\u201D");
        return new String[]{title, b.toString()};
    }

    /** Right after office: protect the night. */
    static String[] night(Ctx c) {
        String title = "Phone down" + c.meComma();
        String b = "Office is over. No reels, no news feed: dinner, " + (c.self ? "a short walk" : "a few minutes with " + c.her()) + ", sleep by " + (c.sleepAt.isEmpty() ? "12:30" : c.sleepAt) + ".\n\n"
            + "Every hour you scroll tonight is taken from tomorrow" + (c.sdAt.isEmpty() ? "" : "'s " + c.sdAt + " deep work") + "."
            + (c.sdNext.isEmpty() ? "" : " Tomorrow's first task is already waiting: \u201C" + c.sdNext + "\u201D.");
        return new String[]{title, b};
    }

    /** Silent check after bedtime: no sound, seen only if the phone is already in hand. */
    static String[] late(Ctx c, String clock) {
        String title = "It's " + clock + ". Still on your phone?";
        String b = "Put it down and sleep. Your " + (c.sdAt.isEmpty() ? "next deep-work" : c.sdAt) + " block needs a clear head" + (c.self ? "." : ", and " + c.her() + " need" + c.s() + " you rested.")
            + (c.daysLeft >= 0 ? " " + c.daysLeft + " days to go; tired mornings don't win them." : "");
        return new String[]{title, b};
    }

    static String[] sleep(Ctx c) {
        String title = "Wind down" + c.meComma();
        String b = "Sleep by " + (c.sleepAt.isEmpty() ? "12:30" : c.sleepAt) + ". Charge the phone outside the bedroom tonight."
            + ("ok".equals(c.status) ? " Today is complete. You kept your word." : " Whatever is left, tomorrow's morning block will cover it.");
        return new String[]{title, b};
    }

    static String[] family(Ctx c, boolean morning, String quote) {
        String title = morning ? "Good morning" + c.meComma() : (c.self ? "Laptop closed. Personal time" : "Laptop closed. Time with " + c.her());
        String until = c.sdAt.isEmpty() ? "your deep work" : c.sdAt;
        String b;
        if (c.self) b = morning ? "Before any app: water, daylight, a plan for the day. Phone in your pocket until " + until + ", then the timer, not the feed."
                                : "Walk, read, rest. Recovery is part of the plan. Phone in another room.";
        else b = morning ? "Before any app: " + c.her() + " first. Phone in your pocket until " + until + ", then the timer, not the feed."
                         : c.Her() + " will remember this time, not the notifications you missed. Phone in another room.";
        if (quote != null && !quote.isEmpty()) b += "\n\n\u201C" + quote + "\u201D";
        return new String[]{title, b};
    }

    /** Morning motivation slots: alternate a personal hook with today's concrete next step. */
    static String[] motivation(Ctx c, int idx, String quote) {
        String track = c.sdDone ? "dsa" : "sd";
        String item = "sd".equals(track) ? c.sdNext : c.dsaNext;
        String title;
        if (idx == 0 && c.hour < 10) title = "Good morning" + c.meComma() + (c.self || c.her.isEmpty() ? "" : ". This one is for " + c.her);
        else if (c.missedYesterday) title = "Today is the comeback" + c.meComma();
        else title = c.self || c.her.isEmpty() ? "Before you open another app" : "For " + c.her;
        StringBuilder b = new StringBuilder("\u201C").append(quote == null ? "" : quote).append("\u201D");
        String h = hook(c);
        if (!h.isEmpty()) b.append("\n\n").append(h);
        if (!item.isEmpty()) b.append("\n\nNext: \u201C").append(item).append("\u201D, ").append("sd".equals(track) ? c.sdMin : c.dsaMin).append(" min.");
        return new String[]{title, b.toString()};
    }
}
