# DataLeap

Daily prep tracker for **data engineering DSA and system design** interviews at top product companies (Uber, Google, Databricks, Visa and similar), aimed at engineers with 10+ years of experience targeting senior and staff roles.

DataLeap is not a practice platform. DSA questions link to NeetCode (free, with video solutions); system design items link to videos, articles or Exponent; DataLeap tracks the time you spend each day, the status of every question, your notes, and when to revise.

## Daily goal

1 DSA question + 1 system design unit (one part of a design case, one video, one summary, or one concept). A day is complete when both have a session over the minimum time.

## Repository layout

```
dataleap/
├── docs/                  GitHub Pages site (static prototype, works today)
│   ├── index.html         Today: the daily run, timer, history grid, revision queue
│   ├── dsa.html           DSA questions by topic
│   ├── system-design.html Design cases and concepts by topic
│   ├── roadmap.html       24-week plan from scratch to offer
│   ├── companies.html     Where to go deeper for each target company
│   ├── progress.html      Time reports, topic table, backup/restore
│   ├── settings.html      Reminders and daily goal
│   ├── .nojekyll          Serve files as-is (no Jekyll processing)
│   └── assets/
│       ├── css/main.css
│       └── js/
│           ├── data.js    All topics and questions (single source of truth, later the Django seed)
│           └── app.js     Storage, timer, dialogs, page logic
├── design/                Product and technical design documents
├── backend/               Django + DRF API and web app (planned)
└── android/               Kotlin + Jetpack Compose app (planned)
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
