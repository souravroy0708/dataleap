# Architecture

## Stage 1: static prototype (now)

- GitHub Pages serves `docs/`. Plain HTML, CSS and JavaScript, no build step.
- Content: `docs/assets/js/data.js`.
- State: browser localStorage (`dataleap:v1`, timer in `dataleap:timer`). Export/import JSON from Progress.
- Reminders: browser notifications, only while a DataLeap tab is open.

## Stage 2: Django backend + Android app

| Layer | Choice |
| --- | --- |
| Backend | Python 3.12, Django 5.x, Django REST Framework, simplejwt |
| Web UI | Django templates + HTMX (ports the pages in `docs/`) |
| Database | PostgreSQL |
| Jobs | Celery + Redis: day close, streaks, weekly report |
| Android | Kotlin, Jetpack Compose, Room (offline), WorkManager (sync), Hilt, Retrofit |
| Reminders | AlarmManager exact alarms on the phone (work offline, app closed) |
| Timer | Android foreground service, survives switching to the browser |

## Migration path

1. `data.js` → management command `load_seed` that creates Track, Topic, Item and ItemLink rows.
2. The localStorage backup JSON → `POST /api/v1/import` so prototype history moves into the account.
3. Page by page, `docs/*.html` become Django templates with the same CSS.

## Django apps

- `accounts`: user, goal settings, reminders
- `content`: tracks, topics, items, links, company tags
- `tracking`: sessions, notes, item status, day summaries, streaks
- `revision`: review schedule
