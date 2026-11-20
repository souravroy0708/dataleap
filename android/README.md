# Android app (planned)

Kotlin, Jetpack Compose, MVVM, Hilt, Retrofit, Room, WorkManager, DataStore.

```
android/app/src/main/java/.../dataleap/
├── data/          Room entities and DAOs, Retrofit API, repositories, sync worker
├── reminders/     AlarmManager scheduling, boot and time-zone receivers
├── timer/         foreground service with live notification
├── ui/today/      daily run, timer, revision queue
├── ui/items/      topic lists, item detail, notes
├── ui/progress/   reports and history grid
└── ui/settings/   goal and reminders
```

Key behaviours: reminders fire with the app closed, skip when that part of the day is done, and the timer survives switching to the browser to solve on NeetCode.
