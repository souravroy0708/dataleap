# DataLeap

Daily prep tracker for **staff-level data engineering system design and DSA** interviews at top product companies (Uber, Google, Databricks, Visa and similar), aimed at engineers with 10+ years of experience targeting senior and staff roles.

DataLeap is not a practice platform. DSA questions link to NeetCode (free, with video solutions); system design items link to videos, articles or Exponent; DataLeap tracks the time you spend each day, the status of every question, your notes, and when to revise.

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
