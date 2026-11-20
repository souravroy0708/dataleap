# Backend (planned)

Django 5.x + Django REST Framework. See `../design/architecture.md`.

```
backend/
├── manage.py
├── requirements.txt
├── dataleap/            settings, urls, wsgi/asgi
├── accounts/            user, goal settings, reminders
├── content/             tracks, topics, items, links; management command load_seed
├── tracking/            sessions, notes, item status, day summaries, streaks
├── revision/            review schedule
├── web/                 Django templates + HTMX (ported from ../docs)
└── tests/
```

Start with `content` and `load_seed` (reads the item list from `../docs/assets/js/data.js` exported as JSON).
