# DataLeap

Daily prep tracker for **staff-level data engineering system design and DSA** interviews at top product companies (Uber, Google, Databricks, Visa and similar), aimed at engineers with 10+ years of experience targeting senior and staff roles.

DataLeap is not a practice platform. DSA questions link to NeetCode (free, with video solutions); system design items link to videos, articles or Exponent; DataLeap tracks the time you spend each day, the status of every question, your notes, and when to revise.

## What is in DataLeap 3.0

- **Mock interview simulator:** a 45-minute system design round in six timed phases, with the interviewer's follow-ups during the deep dive, a staff rubric and an export for AI review.
- **2-minute recall drill:** spaced repetition on your own notes.
- **Applications board:** target → referral → applied → screen → interviews → offer, with follow-up dates and an offer comparison.
- **Home-screen widget:** streak, today's two tasks, next item and days to the offer.
- **Play-ready:** target API 36, edge-to-edge, predictive back, no restricted alarm permission, AAB from the workflow. See `design/play-store.md` and `design/store-listing.md`.

## Your data: export everything for AI analysis

The **Your data** page (header menu, and the "Export for AI" quick action on Today) exports everything DataLeap tracks:

- **Focus:** everything, interview prep, fitness and food, or career and job search. **Range:** 7, 30 or 90 days, or all time.
- **Share AI pack:** one Markdown file with a guide written for the AI (who you are, your goals, pace and readiness, what every column means, and what to analyse) followed by every table as CSV. In the Android app it opens the share sheet, so you can send it straight to the AI app you use (Claude, ChatGPT, Gemini, Grok or any other); it is also saved in Downloads/DataLeap.
- **Separate files:** up to 19 CSV files plus the guide (a zip on the website).
- Tables: daily_overview (all goals per day), sessions, daily, weekly, items, notes, design_scores, recall_drill, retrospectives, mock_interviews, stories, applications, milestones, workouts, weight, meals, profile_and_goals, day_plan, reminders.
- A prompt library with copy buttons, a monthly "review time" nudge on Today, and full JSON backup and restore.

## Private access

DataLeap opens with a 6-digit PIN, asked once per phone. Share the PIN only with the friends you want to use it. To change it, compute a new hash and replace `LOCK_HASH` in `docs/assets/js/app.js`:

```
node -e "let h=0x811c9dc5;for(const c of 'dataleap-lock::NEWPIN'){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0}console.log(h.toString(16))"
```

The PIN keeps casual users out; it is not encryption. The privacy policy page stays open without it.

## Two goals: career and fitness

The default plan is personal: Staff Data Engineer by October 2027, and 72 → 65 kg with strength and stamina. The day plan puts deep work first, then the gym, then family, around a 2:30 to 11:30 pm shift. The Fitness page has the program (Strength A and B, conditioning, walks), weigh-ins with a trend and finish date, a workout log, nutrition for the shift and its own milestones and reminders. Everything is editable.

## For anyone making the switch

DataLeap is for any data engineer moving from a service company to a product company. On first launch a two-minute setup asks (all optional):
- you: name, years of experience, target role, companies, offer date
- who you are doing this for: daughter, son, children, parents, mother, father, wife, husband, partner, family, yourself or someone else, with names, age for children and pronouns
- your day: shift timings (any shift, including night), office days, commute, wake and sleep
- your pace: hours a week, starting level, rest days, motivating notifications

Every quote, coach line, notification and plan block adapts to those answers. Change them any time on My why, My day and Reminders, or rerun setup. Everything stays on the phone. Publishing on Google Play: see `design/play-store.md`.

## Daily goal

System design first, DSA second. Every day: 1 system design unit (a concept, a video, a summary, or one part of a design case) and 1 DSA question. A day is complete when both have a session over the minimum time.

## Habit ladder

| Level | System design | DSA | Minimum | Unlocks after |
| --- | --- | --- | --- | --- |
| 1 Show up | 10 min | 10 min, Easy only | 5 min | 10 complete days |
| 2 Build the habit | 20 min | 15 min, Easy and Medium | 10 min | 14 complete days |
| 3 Go deeper | 30 min, design case parts | 25 min, Medium | 15 min | 28 complete days |
| 4 Interview pace | 45 min, full cases + staff rubric | 30 min, Medium and Hard | 20 min | — |

## Staying consistent

- **My why** page: your daughter's name, one sentence on why, what changes for her, your family and you, and a letter to read on offer day.
- A quote on every page and in every reminder, personalised with her name.
- Quote balloons: they float up on your first visit each day, when you complete a day or level up, and whenever you tap **Motivate me**. Pop one to burst it into a quote card.
- Streak milestones, level-ups, "never miss twice" after a missed day, and a late-evening rescue prompt.
- Reminders: export to the phone calendar (fires even when the site is closed) and browser notifications while DataLeap is open. Install it to the home screen from Chrome for an app-like experience.

## Repository layout

```
dataleap/
├── docs/                  GitHub Pages site (static prototype, works today)
│   ├── career.html        Career kit: story bank, mock interviews, commitment, accountability
│   ├── setup.html         First-run setup: you, your why, your day, your pace
│   ├── privacy.html       Privacy policy (needed for Google Play)
│   ├── plan.html          My day: schedule around office hours and family, priorities, career timeline
│   ├── index.html         Today: why strip, level, the daily run, timer, history grid, revision queue
│   ├── dsa.html           DSA questions by topic
│   ├── system-design.html Design cases and concepts by topic
│   ├── library.html       Your Aced course: 146 lessons indexed and ranked for staff DE, with status, notes and time
│   ├── roadmap.html       24-week plan from scratch to offer
│   ├── companies.html     Where to go deeper for each target company
│   ├── progress.html      Time reports, topic table, backup/restore
│   ├── why.html           My why: vision for her, family and you; letter for offer day
│   ├── settings.html      Reminders, notifications, calendar export, habit ladder
│   ├── sw.js              Service worker: notifications on Android, offline use
│   ├── manifest.webmanifest  Install to home screen
│   ├── .nojekyll          Serve files as-is (no Jekyll processing)
│   └── assets/
│       ├── fonts/         Anek Latin + Mukta, self-hosted (OFL licences included)
│       ├── icons/         App icons
│       ├── css/main.css
│       └── js/
│           ├── data.js    All topics and questions (single source of truth, later the Django seed)
│           ├── library.js Course index: lesson titles, aced.io links, module, priority (no lesson content)
│           └── app.js     Storage, timer, dialogs, page logic
├── design/                Product and technical design documents
├── backend/               Django + DRF API and web app (planned)
└── android/               Android app: native alarms, notifications and timer around the same UI (see android/README.md)
```

## Host on GitHub Pages

1. Push this repository to GitHub.
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**.
3. Branch: `main`, folder: `/docs`. Save.
4. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or two.

## Run locally

```
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

## Where data lives

The static site stores progress in the browser's localStorage. Export a backup from **Progress** regularly. The Django backend and Android app replace this with a synced account (see `design/`).

## Adding questions

Edit `docs/assets/js/data.js`. Add a title, topic code and link, or short question text in your own words. Do not copy problem statements from other platforms.

## Design

Same design language as Bas 1 Minute and Kharcha Check: ink + haldi, Anek Latin + Mukta, self-hosted fonts, no third-party scripts or trackers.

## Library and course material

`library.html` indexes your Aced (formerly Exponent) lessons by title and links to each one on aced.io. Lesson content is **not** in this repo, on purpose: it is paid course material, and GitHub Pages sites are public. Keep your saved offline copies (the `*-Ex` folders) on your own device or private drive.

Upload only `dataleap.zip` to the repo root. The unzip workflow unpacks **any** zip it finds there, so a course zip uploaded by mistake would end up public.

To add lessons later, append entries to `docs/assets/js/library.js` (title, link, module, priority).

## Android app

Install on your phone from `https://souravroy0708.github.io/dataleap/download/dataleap.apk` (Reminders page → Download the Android app). Build and signing instructions are in `android/README.md`.
