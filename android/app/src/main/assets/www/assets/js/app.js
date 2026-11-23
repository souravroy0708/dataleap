/* DataLeap static prototype. All data stays in this browser (localStorage).
   Export from Progress to back up; the Django + Android version replaces this storage with the API. */
(function () {
  const D = window.DL_DATA;
  const BR = window.AndroidBridge || null; // present inside the Android app
  const LIB = window.DL_LIB || { groups: [], lessons: [] };
  const LIB_PRIO = { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 2, L7: 3 };
  const TIER = { must: 'Must do', useful: 'Useful', skip: 'Skip unless time', sql: 'SQL round' };
  LIB.lessons.forEach((l) => D.items.push({
    id: l.id, track: l.g === 'L7' ? 'sql' : 'sd', topic: l.g, title: l.t, type: l.kind === 'case' ? 'libcase' : 'lesson', lib: true, tier: l.tier,
    links: (LIB.offline ? [{ p: 'Offline copy', url: LIB.offline + l.id.slice(2) + '.html' }].concat(l.sol ? [{ p: 'Offline solution', url: LIB.offline + l.id.slice(2) + '--solution.html' }] : []) : [])
      .concat([{ p: 'Aced', url: l.u }]).concat(l.sol ? [{ p: 'Solution', url: l.u + '?tab=solution' }] : []),
    text: l.why ? 'Why it matters for staff DE: ' + l.why : ''
  }));
  const KEY = 'dataleap:v1';
  const TKEY = 'dataleap:timer';
  const byId = Object.fromEntries(D.items.map((i) => [i.id, i]));
  const libTopics = LIB.groups.map((g) => ({ code: g.code, name: g.name, priority: LIB_PRIO[g.code] || 2, why: '', track: g.code === 'L7' ? 'sql' : 'sd', lib: true }));
  const topics = [...D.sdTopics.map((t) => ({ ...t, track: 'sd' })), ...D.dsaTopics.map((t) => ({ ...t, track: 'dsa' })), ...libTopics];
  const topicBy = Object.fromEntries(topics.map((t) => [t.code, t]));

  const STATUS = {
    dsa: [['not_started', 'Not started'], ['not_solved', 'Not solved'], ['with_help', 'Solved with help'], ['solved', 'Solved on my own'], ['revise', 'Revise'], ['mastered', 'Mastered']],
    sd: [['not_started', 'Not started'], ['in_progress', 'In progress'], ['done', 'Done'], ['revise', 'Revise'], ['mastered', 'Mastered']]
  };
  STATUS.sql = STATUS.sd;
  const STATUS_LABEL = Object.fromEntries([...STATUS.dsa, ...STATUS.sd]);
  const ACTIVITY = {
    dsa: [['solve', 'Solve'], ['revise', 'Revise']],
    sd: [['practise', 'Practise a part'], ['full', 'Full case, timed'], ['watch', 'Watch a video'], ['summarise', 'Summarise'], ['read', 'Read a concept'], ['lesson', 'Course lesson'], ['revise', 'Revise']],
    sql: [['read', 'Read the lesson'], ['practise', 'Practise queries'], ['revise', 'Revise']]
  };
  const PARTS = ['Requirements', 'Scale estimates', 'High-level architecture', 'Storage and data model', 'Processing (batch/stream)', 'Failures and backfills', 'Data quality', 'Trade-offs'];
  const NOTE_TYPES = ['Approach', 'Mistake', 'Key insight', 'Summary', 'Interview follow-up'];
  const TRACK = { sd: 'System design', dsa: 'DSA', sql: 'SQL' };

  // ---------- storage ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const defaults = () => ({
    items: {},
    sessions: [],
    rest: [],
    settings: { levelMode: 'auto', level: 1, levelSince: ymd(new Date(Date.now() - 4 * 3600e3)), manual: { sd: 30, dsa: 25, min: 10 }, weekendX: 1.5, dayStart: 4, restPerWeek: 1, maxSession: 30, motiv: { on: true, count: 4, start: '06:00', end: '14:00', weekly: true } },
    profile: {
      me: 'Sourav', years: 10, life: { officeStart: '14:30', officeEnd: '23:30', commute: 30, wake: '07:30', sleep: '00:30', weekendOff: true }, name: '', why: '', role: 'Staff Data Engineer', companies: 'Google, Uber, Visa', targetDate: '2027-09-30', hoursGoal: 250,
      vision: {
        daughter: ['Her education is planned and funded before she starts school, so her choices never depend on fees.', 'I am home for dinner and bedtime, not stuck on late-night support calls.', 'She grows up watching her father set a hard goal and reach it, one day at a time.', 'Holidays where she sees new places, not just pictures of them.'],
        family: ['A safety cushion: insurance, savings and no month-end worry.', 'A home of our own, chosen together.', 'More evenings and weekends that belong to us.'],
        me: ['Designing data platforms used by millions, with engineers who raise my bar.', 'A staff role where I set technical direction, not just deliver tickets.', 'Learning is part of the job, not squeezed in at midnight.', 'Proof to myself that a long career in services can lead anywhere.']
      },
      letter: ''
    },
    reminders: [
      { id: 'r1', time: '07:00', days: [1, 2, 3, 4, 5], focus: 'sd', msg: 'Before work: 10 minutes of system design', skip: true, last: false, on: true },
      { id: 'r2', time: '13:30', days: [1, 2, 3, 4, 5], focus: 'sd', msg: 'Lunch break: one system design video or summary', skip: true, last: false, on: true },
      { id: 'r3', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], focus: 'dsa', msg: 'DSA slot: one question', skip: true, last: false, on: true },
      { id: 'r4', time: '22:15', days: [0, 1, 2, 3, 4, 5, 6], focus: 'either', msg: 'Last call: the 10-minute version still counts', skip: true, last: true, on: true }
    ],
    fired: {}, hit: {}
  });
  function load() {
    const d = defaults();
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { raw = {}; }
    const s = Object.assign(d, raw);
    s.settings = Object.assign(defaults().settings, raw.settings || {});
    s.settings.manual = Object.assign(defaults().settings.manual, (raw.settings || {}).manual || {});
    s.settings.motiv = Object.assign(defaults().settings.motiv, (raw.settings || {}).motiv || {});
    s.profile = Object.assign(defaults().profile, raw.profile || {});
    s.profile.vision = Object.assign(defaults().profile.vision, (raw.profile || {}).vision || {});
    s.hit = s.hit || {}; s.fired = s.fired || {};
    return s;
  }
  /** In the Android app the database on the phone is the source of truth; browser storage is only a fast cache. */
  function loadBest() {
    let s = load();
    if (BR && BR.dbLoad) {
      try {
        const raw = BR.dbLoad();
        if (raw) {
          const db = JSON.parse(raw);
          if (!s.updatedAt || (db.updatedAt || 0) > s.updatedAt || (!s.sessions.length && db.sessions && db.sessions.length)) {
            localStorage.setItem(KEY, raw); s = load();
          }
        }
      } catch (e) {}
    }
    return s;
  }
  let S = loadBest();
  let syncT;
  let dbT;
  const save = () => {
    S.updatedAt = Date.now();
    const json = JSON.stringify(S);
    try { localStorage.setItem(KEY, json); } catch (e) { toast('Could not save: storage is full or blocked.'); }
    if (BR) {
      clearTimeout(syncT); syncT = setTimeout(syncNative, 250);
      clearTimeout(dbT); dbT = setTimeout(() => { try { BR.dbSave(JSON.stringify(S)); } catch (e) {} }, 400);
    }
  };
  const st = (id) => S.items[id] || { status: 'not_started', notes: [], next: null, solvedCount: 0, pinned: null };

  // ---------- dates and text ----------
  const studyDate = (ts) => ymd(new Date(ts - S.settings.dayStart * 3600e3));
  const today = () => studyDate(Date.now());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
  const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
  const daysBetween = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5); };
  const niceDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtH = (m) => (m >= 60 ? (m / 60).toFixed(1) + ' h' : m + ' min');
  const daughter = () => (S.profile.name || '').trim();
  function personal(t) {
    t = t.replace(/\{years\}/g, String(S.profile.years || 10));
    const n = daughter();
    if (n) return t.replace(/\{name\}/g, n);
    return t.replace(/^\{name\}/, 'Your daughter').replace(/\{name\}/g, 'your daughter');
  }

  // ---------- levels and targets ----------
  const L = () => D.levels[Math.min(4, Math.max(1, S.settings.level)) - 1];
  function base() { return S.settings.levelMode === 'manual' ? S.settings.manual : L(); }
  function targets(date) {
    const b = base(); const w = dow(date) === 0 || dow(date) === 6;
    const x = (v) => (w ? Math.round((v * S.settings.weekendX) / 5) * 5 : v);
    return { sd: x(b.sd), dsa: x(b.dsa) };
  }
  const minNow = () => base().min;

  // ---------- day logic ----------
  function dayInfo(date) {
    const ss = S.sessions.filter((s) => s.date === date);
    const sum = (t) => ss.filter((s) => s.track === t).reduce((a, s) => a + s.minutes, 0);
    const counted = (t) => ss.some((s) => s.track === t && s.minutes >= (s.min || 10));
    const dsa = sum('dsa'), sd = sum('sd');
    const dsaDone = counted('dsa'), sdDone = counted('sd');
    let status = 'miss';
    if (dsaDone && sdDone) status = 'ok';
    else if (S.rest.includes(date)) status = 'rest';
    else if (dsa + sd > 0) status = 'part';
    return { dsa, sd, dsaDone, sdDone, status };
  }
  const firstDay = () => S.sessions.reduce((m, x) => (x.date < m ? x.date : m), today());
  function streak() {
    let d = today();
    if (dayInfo(d).status !== 'ok' && !S.rest.includes(d)) d = addDays(d, -1);
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      const s = dayInfo(d).status;
      if (s === 'ok') n++;
      else if (s !== 'rest') break;
      d = addDays(d, -1);
    }
    return n;
  }
  function restUsedThisWeek() { const t = today(); const start = addDays(t, -((dow(t) + 6) % 7)); return S.rest.filter((r) => r >= start && r <= t).length; }
  function completeSince(from) { let n = 0; for (let d = from; d <= today(); d = addDays(d, 1)) if (dayInfo(d).status === 'ok') n++; return n; }
  const totalMinutes = () => S.sessions.reduce((a, s) => a + s.minutes, 0);
  const missedYesterday = () => { const y = addDays(today(), -1); return firstDay() < y && dayInfo(y).status === 'miss' && dayInfo(today()).status !== 'ok'; };

  function checkProgress() {
    if (S.settings.levelMode === 'auto' && S.settings.level < 4) {
      const lv = L();
      if (completeSince(S.settings.levelSince) >= lv.need) {
        S.settings.level += 1; S.settings.levelSince = today(); save();
        const nl = L();
        celebrate('Level ' + nl.n + ' unlocked: ' + nl.name, 'Targets are now system design ' + nl.sd + ' min and DSA ' + nl.dsa + ' min a day.');
      }
    }
    checkAchievements();
  }
  function celebrate(title, body) { setTimeout(() => { toast(title + '. ' + body); releaseBalloons(6, ['family', 'habit'], false); }, 400); notify(title, body, 'index.html', 'dl-celebrate'); }

  // ---------- status and revision ----------
  function setStatus(id, status) {
    const s = st(id); const prev = s.status; s.status = status; const t = today();
    if (status === 'solved') {
      s.solvedCount = (s.solvedCount || 0) + 1;
      if (s.solvedCount >= 3) { s.status = 'mastered'; s.next = null; } else s.next = addDays(t, [7, 14, 30][s.solvedCount - 1]);
    } else {
      if (status === 'not_solved') s.solvedCount = 0;
      const gap = { not_solved: 1, with_help: 3, revise: 2, in_progress: 1, done: 14 }[status];
      s.next = gap ? addDays(t, gap) : null;
    }
    s.history = s.history || [];
    if (prev !== s.status) s.history.push({ from: prev, to: s.status, at: Date.now() });
    S.items[id] = s; save();
  }
  const isDue = (id) => { const s = S.items[id]; return !!(s && s.next && s.next <= today() && !['not_started', 'mastered'].includes(s.status)); };
  const dueItems = (track) => D.items.filter((i) => (!track || i.track === track) && isDue(i.id));
  const minutesFor = (id) => S.sessions.filter((s) => s.itemId === id).reduce((a, s) => a + s.minutes, 0);
  function nextPart(id) { const done = new Set(S.sessions.filter((s) => s.itemId === id && s.part).map((s) => s.part)); return PARTS.find((p) => !done.has(p)) || null; }

  // ---------- your coaching profile (imported privately from the Career kit) ----------
  const CP = () => S.coach || null;
  const expFor = (id) => { const c = CP(); return c ? (c.experience || []).find((e) => e.case === id) : null; };
  const gapFor = (topic) => { const c = CP(); return c ? (c.gaps || []).find((g) => g.topic === topic) : null; };
  function focusNow() {
    const c = CP(); if (!c || !c.focus90 || !c.importedAt) return null;
    const m = Math.min(c.focus90.length - 1, Math.floor((Date.now() - c.importedAt) / (30 * 864e5)));
    return c.focus90[m];
  }

  function suggest(track) {
    const lv = L();
    const due = dueItems(track);
    if (due.length) return { item: due[0], why: 'Due for revision', how: 'Re-solve or re-explain it without notes, then read your pinned note.' };
    const weekAgo = addDays(today(), -6);
    const weekMin = (code) => S.sessions.filter((s) => s.date >= weekAgo && byId[s.itemId] && byId[s.itemId].topic === code).reduce((a, s) => a + s.minutes, 0);
    if (track === 'dsa') {
      const order = D.dsaTopics.slice().sort((a, b) => a.priority - b.priority || weekMin(a.code) - weekMin(b.code));
      for (const diff of lv.dsaDiff) {
        for (const t of order) {
          const it = D.items.find((i) => i.topic === t.code && i.diff === diff && st(i.id).status === 'not_started');
          if (it) return { item: it, why: 'Next', how: lv.dsaHow };
        }
      }
      const any = D.items.find((i) => i.track === 'dsa' && st(i.id).status === 'not_started');
      return any ? { item: any, why: 'Next', how: lv.dsaHow } : null;
    }
    const order = CP() && CP().gapOrder ? [...CP().gapOrder.filter((c) => D.sdCurriculum.includes(c)), ...D.sdCurriculum.filter((c) => !CP().gapOrder.includes(c))] : D.sdCurriculum;
    const concepts = () => {
      for (const code of order) {
        const ip = D.items.find((i) => i.topic === code && st(i.id).status === 'in_progress');
        if (ip) return ip;
        const it = D.items.find((i) => i.topic === code && st(i.id).status === 'not_started');
        if (it) return it;
      }
      return null;
    };
    const cases = () => D.items.find((i) => i.type === 'case' && st(i.id).status === 'in_progress') ||
      D.items.find((i) => i.type === 'case' && expFor(i.id) && st(i.id).status === 'not_started') ||
      D.items.find((i) => i.type === 'case' && st(i.id).status === 'not_started');
    const fromLib = (pred) => { const ls = D.items.filter((i) => i.lib && i.track === 'sd' && i.tier === 'must' && pred(i)); return ls.find((i) => st(i.id).status === 'in_progress') || ls.find((i) => st(i.id).status === 'not_started'); };
    const odd = daysBetween('2026-01-01', today()) % 2 === 1;
    if (lv.sdMode === 'concept') {
      const c = concepts(); const l = fromLib((i) => i.type === 'lesson' || i.topic === 'L2');
      const pick = (odd && c) ? c : (l || c || cases());
      if (!pick) return null;
      if (pick.lib) return { item: pick, why: 'Course lesson', how: 'Open it on Aced and study it for ' + targets(today()).sd + ' minutes, then write a 5-line summary here.' };
      const g = gapFor(pick.topic);
      return { item: pick, why: g ? 'Closing a gap' : 'Next concept', how: g ? g.title + ': ' + g.action : lv.sdHow };
    }
    const k = cases(); const lk = fromLib((i) => i.type === 'libcase');
    const c = (odd && lk) ? lk : (k || lk || concepts());
    if (!c) return null;
    const isCase = c.type === 'case' || c.type === 'libcase';
    const part = isCase && lv.sdMode === 'case-part' ? nextPart(c.id) : null;
    const how = c.lib ? (part ? 'Try the ' + part.toLowerCase() + ' part yourself first, then compare with the lesson on Aced.' : 'Attempt it in 45 to 60 minutes before opening the lesson, then score it with the rubric.') : (part ? 'Today\'s part: ' + part + '. ' + lv.sdHow : lv.sdHow);
    const ex = expFor(c.id);
    return { item: c, why: ex ? 'You built this' : c.lib ? 'Course design case' : isCase ? 'Design case' : 'Next concept', how: ex ? 'From your career: ' + ex.from + '. Answer with your real system first, then adapt it to this prompt. ' + how : how, part };
  }

  // ---------- coach: speaks to you by name, from your real state ----------
  const me = () => (S.profile.me || '').trim();
  const her = () => daughter() || 'your daughter';
  const cap = () => Math.max(10, Math.min(120, +S.settings.maxSession || 30));
  function pickBy(key, list) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return list[h % list.length]; }
  function greeting() {
    const h = new Date().getHours(); const n = me() ? ', ' + me() : '';
    if (h < 5) return 'Still up' + n + '?';
    if (h < 12) return 'Good morning' + n + '.';
    if (h < 17) return 'Good afternoon' + n + '.';
    if (h < 21) return 'Good evening' + n + '.';
    return 'It’s late' + n + '.';
  }
  function coachMessage() {
    const t = today(); const i = dayInfo(t); const tg = targets(t); const h = new Date().getHours();
    const sk = streak(); const sd = suggest('sd'); const ds = suggest('dsa'); const m = minNow();
    const sdName = sd ? sd.item.title : 'one system design topic'; const dsName = ds ? ds.item.title : 'one DSA question';
    const k = t + i.status;
    let body;
    if (!S.sessions.length) {
      body = 'You bring ' + (S.profile.years || 10) + ' years of real systems. What’s missing is only interview practice, and that we build daily. Today I’ll keep it small: ' + tg.sd + ' minutes of system design, ' + tg.dsa + ' of DSA. Start with “' + sdName + '”.';
    } else if (S.rest.includes(t) && i.status !== 'ok') {
      body = 'Rest day. Rest is part of the plan, not a break from it. Be fully with ' + her() + ' today; we go again tomorrow.';
    } else if (i.status === 'ok') {
      body = h >= 20 ? pickBy(k, ['Both done. You kept your word to ' + her() + ' today. Close the laptop and go be with her.', 'Day complete. ' + (sk > 1 ? sk + ' days in a row. ' : '') + 'The rest of tonight belongs to your family.'])
        : pickBy(k, ['Both done before evening. That is the kind of consistency interviewers can feel.', 'Day complete' + (sk > 1 ? ', ' + sk + ' in a row' : '') + '. Anything more today is a bonus, not a debt.']);
    } else if (missedYesterday()) {
      body = 'Yesterday slipped. It happens to everyone who is busy and still trying. What matters is today: ' + m + ' minutes on “' + sdName + '” and the habit is alive again.';
    } else if (i.sdDone && !i.dsaDone) {
      body = pickBy(k, ['System design is done. One DSA question and today is yours: “' + dsName + '”, ' + tg.dsa + ' minutes.', 'The hard part is done. Finish with “' + dsName + '” and close the day.']);
    } else if (i.dsaDone && !i.sdDone) {
      body = 'DSA done. Now the round that decides staff offers: “' + sdName + '”, ' + tg.sd + ' minutes.';
    } else if (h < 12) {
      body = pickBy(k + 'm', ['You already know how these systems run in production. Today, practise explaining one the way a product interviewer wants: “' + sdName + '”, ' + tg.sd + ' minutes.', 'Before the day takes over, give ' + her() + ' ' + tg.sd + ' minutes. Start with “' + sdName + '”.', 'Mornings are yours before they are anyone else’s. ' + tg.sd + ' minutes on “' + sdName + '” and the hardest part of today is done.']);
    } else if (h < 18) {
      body = pickBy(k, ['The day is half gone, the chance isn’t. ' + m + ' minutes now beats an hour you never find. Start with “' + sdName + '”.', 'Find one quiet slot in the next hour. “' + sdName + '”, ' + tg.sd + ' minutes. I’ll time it.']);
    } else {
      body = pickBy(k, ['I know you’re tired. ' + m + ' honest minutes still count, and they keep the promise you made to ' + her() + '.', 'Long day. Don’t aim for perfect, aim for done: ' + m + ' minutes on “' + sdName + '” and the streak lives.']);
    }
    let extra = '';
    if (i.status !== 'ok') {
      const nextM = Object.keys(D.milestones).map(Number).find((x) => x > sk);
      if (sk >= 2 && nextM && nextM - sk <= 2) extra = ' ' + (nextM - sk) + ' more day' + (nextM - sk > 1 ? 's' : '') + ' to a ' + nextM + '-day streak.';
      else if (sk >= 3) extra = ' ' + sk + ' days in a row so far. Don’t break it tonight.';
    }
    const fz = focusNow();
    if (fz && i.status !== 'ok' && S.sessions.length && !/office|sleep|family/.test((nowBlock().cur || {}).kind || '')) extra += ' This month’s focus: ' + fz.title.toLowerCase() + '.';
    const sn = scheduleNote(i);
    if (sn && i.status !== 'ok' && S.sessions.length) { body = sn; extra = ''; }
    else if (sn && i.status === 'ok' && /office|sleep/.test((nowBlock().cur || {}).kind || '')) body = sn;
    const plan = latestPlan();
    if (plan && i.status !== 'ok') extra += ' Your plan from the retro: “' + plan + '”.';
    return { head: greeting(), body: body + extra };
  }
  function coachReaction(sess, before, after) {
    const m = sess.minutes; const sk = streak(); const min = sess.min || minNow();
    if (after === 'ok' && before !== 'ok') return 'Day complete' + (me() ? ', ' + me() : '') + '. ' + (sk > 1 ? sk + '-day streak. ' : '') + her().charAt(0).toUpperCase() + her().slice(1) + ' will never see this hour, but she will live inside what it builds.';
    if (m < min) return m + ' minutes logged. ' + (min - m) + ' more and it counts for today. You’re close.';
    const i = dayInfo(sess.date);
    if (sess.track === 'sd' && !i.dsaDone) return 'System design: ' + m + ' minutes in the bank. One DSA question and today is yours.';
    if (sess.track === 'dsa' && !i.sdDone) return 'DSA done. Now the part that wins staff offers: system design.';
    return 'Logged ' + m + ' minutes. Every one of them is on the record, and on her side.';
  }
  const TIMER_LINES = {
    sd: ['Say the trade-off out loud. That is the interview.', 'Numbers first: events per second, TB per day.', 'Phone face down. This half hour is for {her}.', 'Stuck? Ask what breaks at 10x. Then answer it.'],
    dsa: ['Name the pattern first. Then code.', 'Talk through it like the interviewer is here.', 'Phone face down. This half hour is for {her}.', 'Stuck for 10 minutes? Peek at a hint, then close it and finish.']
  };
  function timerLine(t) {
    const el = elapsed(t); const list = TIMER_LINES[t.track] || TIMER_LINES.sd;
    if (el < 60000) return 'Good. You started. That was the hardest part.';
    return list[Math.floor(el / 180000) % list.length].replace('{her}', her());
  }
  function showCoachCard(text, onTap) {
    const wrap = document.getElementById('popwrap'); if (!wrap) return;
    const card = document.createElement('div'); card.className = 'qpop coachpop';
    card.innerHTML = '<span class="coach-av sm" aria-hidden="true">' + MARK + '</span><div><small>Your coach</small><p>' + esc(text) + '</p></div>';
    const close = () => { card.classList.add('out'); setTimeout(() => card.remove(), 300); };
    card.onclick = () => { close(); if (onTap) onTap(); };
    wrap.appendChild(card); while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(close, 8000);
  }

  // ---------- quotes ----------
  const PAGE_QUOTES = { career: ['switch', 'family'], plan: ['family', 'switch'], home: ['habit', 'family', 'switch'], lib: ['habit', 'sd'], sd: ['sd', 'switch'], dsa: ['dsa'], roadmap: ['habit', 'sd', 'switch'], why: ['family'], progress: ['habit', 'switch'], settings: ['habit'], companies: ['sd'] };
  let quoteShift = 0;
  function quoteFor(page, shift) {
    let cats = PAGE_QUOTES[page] || ['habit'];
    if (page === 'home' && missedYesterday()) cats = ['comeback'];
    const list = cats.flatMap((c) => D.quotes[c]);
    let h = 0; const key = today() + page; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return personal(list[(h + (shift || 0)) % list.length]);
  }
  function randomQuote(cat) { const l = D.quotes[cat]; return personal(l[Math.floor(Math.random() * l.length)]); }

  // ---------- chrome ----------
  const NAV = [['index.html', 'Today'], ['plan.html', 'My day'], ['system-design.html', 'System design'], ['dsa.html', 'DSA'], ['library.html', 'Library'], ['career.html', 'Career kit'], ['why.html', 'My why'], ['progress.html', 'Progress'], ['settings.html', 'Reminders']];
  const MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8.5" width="7.5" height="7" rx="2" fill="#0F1235"/><rect x="14.5" y="8.5" width="7.5" height="7" rx="2" fill="none" stroke="#0F1235" stroke-width="2.2"/><path d="M9.5 12h5" stroke="#0F1235" stroke-width="2.2"/></svg>';
  const BALLOON_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="9" rx="6.5" ry="7.5" fill="#0F1235"/><path d="M12 16.5l-1.4 2h2.8z" fill="#0F1235"/><path d="M12 18.5c-1 1.6 1 2.4 0 4" stroke="#0F1235" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="9.6" cy="6.4" rx="1.4" ry="2" fill="#FFC21A"/></svg>';
  function renderChrome() {
    const here = (location.pathname.split('/').pop() || 'index.html');
    const links = NAV.map(([h, l]) => '<a href="' + h + '"' + (h === here ? ' aria-current="page"' : '') + '>' + l + '</a>').join('');
    const head = document.getElementById('top');
    if (head) {
      head.className = 'site-header';
      head.innerHTML = '<div class="wrap header-row"><a class="brand" href="index.html"><span class="brand-mark">' + MARK + '</span><span class="brand-text"><b>DataLeap</b><span>Staff data engineering prep</span></span></a>' +
        '<a class="timer-chip" id="timerchip" href="index.html"></a><nav class="nav-links" aria-label="Main">' + links + '</nav>' +
        '<details class="menu"><summary aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></summary><nav class="menu-panel" aria-label="Main">' + links + '</nav></details></div>';
    }
    const page = document.body.dataset.page;
    const qt = document.getElementById('quote-text');
    if (qt) {
      qt.textContent = quoteFor(page, 0);
      const qn = document.getElementById('quote-next');
      if (qn) qn.onclick = () => { quoteShift++; qt.textContent = quoteFor(page, quoteShift); };
    }
    const foot = document.createElement('footer'); foot.className = 'site';
    foot.innerHTML = '<div class="wrap">Your progress is stored only ' + (BR ? 'on this phone' : 'in this browser') + '. Back it up from <a href="progress.html">Progress</a>. Practice happens on NeetCode and the linked videos; DataLeap keeps your time, status, notes and streak.</div>';
    document.body.appendChild(foot);
    const t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
    document.body.insertAdjacentHTML('beforeend', '<div class="sky" id="sky" aria-hidden="true"></div><div class="popwrap" id="popwrap" aria-live="polite"></div><button class="motivate" id="motivate" type="button">' + BALLOON_IC + '<span>Motivate me</span></button>' +
      '<dialog id="itemdlg" aria-labelledby="itemdlg-title"><div class="dlg" id="itemdlg-body"></div></dialog><dialog id="logdlg" aria-labelledby="logdlg-title"><form class="dlg" id="logform" method="dialog"></form></dialog>');
    document.getElementById('motivate').onclick = () => releaseBalloons(5, null, false);
  }

  // ---------- quote balloons ----------
  const COLORS = ['#FFC21A', '#FF6B4A', '#8F99FF', '#2BB673', '#5B6CFF', '#FF9FB2'];
  const LABELS = ['Tap', 'Pop', 'For her', 'Why', 'Now'];
  const usedQ = new Set();
  function freshQuote(cats) {
    const all = cats.flatMap((c) => D.quotes[c]);
    let pool = all.filter((q) => !usedQ.has(q)); if (!pool.length) { usedQ.clear(); pool = all; }
    const q = pool[Math.floor(Math.random() * pool.length)]; usedQ.add(q); return personal(q);
  }
  function balloonCats() {
    const page = document.body.dataset.page;
    const base = page === 'sd' ? ['sd', 'family', 'switch'] : page === 'dsa' ? ['dsa', 'family'] : ['habit', 'family', 'sd', 'switch'];
    return missedYesterday() ? ['comeback', 'family'] : base;
  }
  function showQuoteCard(text, color) {
    const wrap = document.getElementById('popwrap'); if (!wrap) return;
    const card = document.createElement('div'); card.className = 'qpop'; card.style.setProperty('--c', color || '#FFC21A');
    card.innerHTML = '<p>' + esc(text) + '</p><small>' + (daughter() ? 'For ' + esc(daughter()) : 'Your why') + '</small>';
    const close = () => { card.classList.add('out'); setTimeout(() => card.remove(), 300); };
    card.onclick = close;
    wrap.appendChild(card);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(close, 6500);
  }
  function burst(x, y, color) {
    const sky = document.getElementById('sky');
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('span'); sp.className = 'spark';
      const a = (Math.PI * 2 * i) / 14, r = 50 + Math.random() * 50;
      sp.style.left = x + 'px'; sp.style.top = y + 'px';
      sp.style.background = i % 3 ? color : COLORS[(i + 2) % COLORS.length];
      sp.style.setProperty('--dx', Math.cos(a) * r + 'px'); sp.style.setProperty('--dy', Math.sin(a) * r + 'px');
      sky.appendChild(sp); setTimeout(() => sp.remove(), 750);
    }
  }
  function releaseBalloons(n, cats, autoPop) {
    cats = cats || balloonCats();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sky = document.getElementById('sky'); if (!sky) return;
    if (reduce) { showQuoteCard(freshQuote(cats)); return; }
    const w = window.innerWidth;
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'balloon';
      const color = COLORS[(i + Math.floor(Math.random() * 6)) % COLORS.length];
      b.style.setProperty('--c', color);
      b.style.left = Math.round(((i + 0.5) / n) * (w - 100) + (Math.random() * 40 - 20)) + 'px';
      b.style.setProperty('--dur', (8 + Math.random() * 4).toFixed(1) + 's');
      b.style.setProperty('--delay', (i * 0.35).toFixed(2) + 's');
      b.setAttribute('aria-label', 'Pop for a quote');
      b.innerHTML = '<span class="s"></span><span class="b"></span><span class="t">' + LABELS[i % LABELS.length] + '</span>';
      const pop = () => {
        if (b.dataset.popped) return; b.dataset.popped = '1';
        const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2.4, color);
        b.remove(); showQuoteCard(freshQuote(cats), color);
      };
      b.addEventListener('click', pop);
      b.addEventListener('animationend', (e) => { if (e.animationName === 'rise') b.remove(); });
      sky.appendChild(b);
      if (autoPop && i === 0) setTimeout(pop, 1600);
    }
  }
  let toastT;
  function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 4200); }

  // ---------- notifications (Android Chrome needs the service worker) ----------
  let swReg = null;
  if (!BR && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }
  function notify(title, body, url, tag) {
    if (BR) { try { BR.notify(title, body); return true; } catch (e) { return false; } }
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const opts = { body, tag: tag || 'dataleap', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', data: { url: url || 'index.html' } };
    if (swReg && swReg.showNotification) { swReg.showNotification(title, opts); return true; }
    try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); location.href = url || 'index.html'; }; return true; } catch (e) { return false; }
  }

  // ---------- timer ----------
  const getT = () => { try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { return null; } };
  const setT = (t) => {
    if (t) localStorage.setItem(TKEY, JSON.stringify(t)); else localStorage.removeItem(TKEY);
    if (!BR) return;
    try {
      if (!t) { BR.timerStopped(); return; }
      const it = byId[t.itemId]; const title = (it ? it.title : '') + (t.part ? ' (' + t.part + ')' : '');
      if (t.paused) BR.timerPaused(t.track, title);
      else { const eff = t.start - t.acc; BR.timerStarted(t.track, title, eff, t.told ? 0 : eff + t.goalMs, eff + cap() * 60000); }
    } catch (e) {}
  };
  const elapsed = (t) => (t ? t.acc + (t.paused ? 0 : Date.now() - t.start) : 0);
  const clock = (ms) => { const s = Math.floor(ms / 1000); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
  function startTimer(track, itemId, opts) {
    opts = opts || {};
    if (getT()) { toast('A timer is already running. Stop it first.'); return; }
    const info = dayInfo(today()); const tg = targets(today())[track];
    const goalMs = Math.min(cap(), Math.max(minNow(), tg - (track === 'dsa' ? info.dsa : info.sd))) * 60000;
    setT({ track, itemId: itemId || null, start: Date.now(), acc: 0, paused: false, goalMs, told: false, part: opts.part || '' });
    const it = byId[itemId];
    if (it && it.links[0] && !opts.noOpen) { if (BR) BR.openExternal(it.links[0].url); else window.open(it.links[0].url, '_blank', 'noopener'); }
    tick(); refresh();
    toast('Timer started' + (it ? ' for ' + it.title : '') + '. Target ' + Math.round(goalMs / 60000) + ' min; it stops and saves by itself at ' + cap() + ' min.');
  }
  function pauseTimer() { const t = getT(); if (!t) return; if (t.paused) { t.start = Date.now(); t.paused = false; } else { t.acc = elapsed(t); t.paused = true; } setT(t); tick(); }
  function stopTimer() { const t = getT(); if (!t) return; openLog({ track: t.track, itemId: t.itemId, minutes: Math.max(1, Math.round(elapsed(t) / 60000)), fromTimer: true, part: t.part }); }
  /** A forgotten timer never inflates your hours: at the longest-session limit it stops and saves itself. */
  function autoStop(t) {
    const m = cap(); const it = byId[t.itemId];
    const sess = { id: 's' + Date.now(), date: studyDate(t.start - t.acc + m * 60000), track: t.track, itemId: t.itemId || null, minutes: m, min: minNow(),
      activity: t.track === 'dsa' ? 'solve' : (it && (it.type === 'case' || it.type === 'libcase') ? 'practise' : 'read'), part: t.part || '', source: 'auto-stop', at: Date.now() };
    const before = dayInfo(sess.date).status;
    S.sessions.push(sess);
    if (it && st(it.id).status === 'not_started' && it.track !== 'dsa') setStatus(it.id, 'in_progress');
    save(); setT(null);
    const after = dayInfo(sess.date).status;
    showCoachCard(m + ' minutes. I stopped the timer and saved it, so nothing is lost and nothing is overcounted. ' + (it ? 'Tap to mark how “' + it.title + '” went.' : coachReaction(sess, before, after)), it ? () => openItem(it.id) : null);
    if (after === 'ok' && before !== 'ok') releaseBalloons(7, ['family'], true);
    checkProgress(); refresh();
  }
  function tick() {
    const t0 = getT();
    if (t0 && !t0.paused && elapsed(t0) >= cap() * 60000) { autoStop(t0); }
    const t = getT();
    if (t && !t.told && !t.paused && elapsed(t) >= t.goalMs) {
      t.told = true; setT(t);
      notify('Target reached', TRACK[t.track] + ': ' + Math.round(t.goalMs / 60000) + ' minutes done. Stop and log it, or keep going.', 'index.html', 'dl-target');
      toast('Target reached. Stop and log it, or keep going.');
    }
    const chip = document.getElementById('timerchip');
    if (chip) { chip.classList.toggle('on', !!t); chip.textContent = t ? TRACK[t.track] + ' ' + clock(elapsed(t)) + (t.paused ? ' (paused)' : '') : ''; }
    const bar = document.getElementById('timerbar');
    if (bar) {
      bar.classList.toggle('on', !!t);
      if (t) {
        const it = byId[t.itemId];
        const pct = Math.min(100, Math.round((elapsed(t) / t.goalMs) * 100));
        bar.innerHTML = '<span class="clock">' + clock(elapsed(t)) + '</span><span>' + TRACK[t.track] + (it ? ': <button class="linkish" data-open="' + it.id + '">' + esc(it.title) + '</button>' : '') + (t.part ? ' <span class="muted">(' + esc(t.part) + ')</span>' : '') + (t.paused ? ' <span class="muted">paused</span>' : '') +
          '<span class="small muted" style="display:block">' + pct + '% of today\'s target · stops and saves at ' + cap() + ':00</span><span class="timerline">' + esc(timerLine(t)) + '</span></span>' +
          (it && it.links[0] ? '<a class="btn" href="' + esc(it.links[0].url) + '" target="_blank" rel="noopener">Open on ' + esc(it.links[0].p) + '</a>' : '') +
          '<span class="actions" style="margin:0 0 0 auto"><button class="btn" data-act="pause">' + (t.paused ? 'Resume' : 'Pause') + '</button><button class="btn primary" data-act="stop">Stop and log</button></span>';
      }
    }
  }

  // ---------- item dialog ----------
  function openItem(id) {
    const it = byId[id]; if (!it) return;
    const s = st(id); const tp = topicBy[it.topic];
    const opts = STATUS[it.track].map(([v, l]) => '<option value="' + v + '"' + (v === s.status ? ' selected' : '') + '>' + l + '</option>').join('');
    const notes = (s.notes || []).slice().sort((a, b) => (b.id === s.pinned) - (a.id === s.pinned) || b.at - a.at);
    const scores = s.scores || [];
    const body = document.getElementById('itemdlg-body');
    const videoLink = it.track === 'sd' && !it.lib ? '<a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(it.title + ' data engineering system design') + '">Find a video</a>' : '';
    const partsDone = (it.type === 'case' || (it.type === 'libcase' && it.track === 'sd')) ? new Set(S.sessions.filter((x) => x.itemId === id && x.part).map((x) => x.part)) : null;
    body.innerHTML =
      '<div class="dlg-head"><div><p class="muted small" style="margin:0">' + esc(tp.code + ' ' + tp.name) + (it.diff ? ', <span class="diff ' + it.diff + '">' + it.diff + '</span>' : '') + (it.type === 'case' ? ', design case' : it.type === 'concept' ? ', concept' : it.lib ? ', ' + TIER[it.tier].toLowerCase() : '') + '</p><h2 id="itemdlg-title">' + esc(it.title) + '</h2></div><button class="btn quiet" data-close aria-label="Close">Close</button></div>' +
      '<div class="links">' + it.links.map((l, i) => '<a class="btn' + (i === 0 ? ' primary' : '') + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + (/^Offline/.test(l.p) ? 'Open ' + esc(l.p.toLowerCase()) : 'Open on ' + esc(l.p)) + '</a>').join('') + (it.premium ? '<span class="chip">Premium</span>' : '') + videoLink + '</div>' +
      ((it.text || it.followUps || it.angle) ? '<div class="prompt">' + (it.text ? '<p style="margin:0">' + esc(it.text) + '</p>' : '') + (it.angle ? '<p class="muted small" style="margin:.3rem 0 0">Data engineering angle: ' + esc(it.angle) + '</p>' : '') +
        (it.followUps ? '<p style="margin:.6rem 0 0"><b>Interviewer follow-ups</b></p><ul>' + it.followUps.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') + '</div>' : '') +
      (expFor(id) ? '<div class="mine-box"><b>You built this.</b> ' + esc(expFor(id).from) + '. Start your answer from your real system, with its real numbers, then adapt it to the prompt.' + (expFor(id).story ? ' <a href="career.html">Your story for it</a>' : '') + '</div>' : '') +
      (partsDone ? '<p class="small"><b>Parts practised:</b> ' + PARTS.map((p) => '<span class="chip ' + (partsDone.has(p) ? 'st-done' : '') + '">' + p + '</span>').join(' ') + '</p>' : '') +
      '<div class="stats"><span>Time spent <b>' + fmtH(minutesFor(id)) + '</b></span><span>Sessions <b>' + S.sessions.filter((x) => x.itemId === id).length + '</b></span><span>Next review <b>' + (s.next || 'none') + '</b></span>' + (scores.length ? '<span>Last score <b>' + scores[scores.length - 1].total + '/14</b></span><span>Best <b>' + Math.max(...scores.map((x) => x.total)) + '/14</b></span>' : '') + '</div>' +
      '<div class="row"><div class="field"><label for="dlg-status">Status</label><select id="dlg-status">' + opts + '</select></div><div class="field" style="flex:0 0 auto"><button class="btn primary" data-start-item="' + id + '">Start timer</button></div><div class="field" style="flex:0 0 auto"><button class="btn" data-log-item="' + id + '">Log time</button></div></div>' +
      ((it.type === 'case' || (it.type === 'libcase' && it.track === 'sd')) ? '<details class="rubricbox"' + (scores.length ? '' : ' open') + '><summary><b>Score a full attempt with the staff rubric</b></summary><form id="rubricform">' + D.rubric.map((r, i) => '<div class="rubric-row"><span>' + esc(r) + '</span><select name="r' + i + '" aria-label="' + esc(r) + '"><option value="0">0 Missed</option><option value="1">1 Partly</option><option value="2">2 Clearly</option></select></div>').join('') + '<button class="btn" type="submit">Save score</button><span class="small muted"> 10 or more out of 14 is interview-ready.</span></form></details>' : '') +
      '<h3 style="margin-top:1rem">Notes</h3><form id="noteform"><div class="row"><div class="field" style="flex:0 0 180px"><label for="note-type">Type</label><select id="note-type">' + NOTE_TYPES.map((n) => '<option>' + n + '</option>').join('') + '</select></div></div><div class="field"><label for="note-body">Note</label><textarea id="note-body" placeholder="Approach, mistake, the one thing to remember next time"></textarea></div><button class="btn" type="submit">Add note</button></form>' +
      '<ul class="notes">' + (notes.length ? notes.map((n) => '<li class="' + (n.id === s.pinned ? 'pinned' : '') + '"><div class="meta"><span>' + esc(n.type) + '</span><span>' + new Date(n.at).toLocaleString() + '</span>' + (n.id === s.pinned ? '<span>Key note</span>' : '<button class="linkish small" data-pin="' + n.id + '">Pin as key note</button>') + '<button class="linkish small" data-delnote="' + n.id + '">Delete</button></div><div class="body">' + esc(n.body) + '</div></li>').join('') : '<li class="muted small" style="border:0;padding-left:0">No notes yet. After each attempt, write the approach and the one mistake you made.</li>') + '</ul>';
    const dlg = document.getElementById('itemdlg'); dlg.dataset.id = id;
    body.querySelector('#dlg-status').addEventListener('change', (e) => { setStatus(id, e.target.value); openItem(id); refresh(); toast('Status saved'); });
    body.querySelector('#noteform').addEventListener('submit', (e) => {
      e.preventDefault(); const txt = body.querySelector('#note-body').value.trim(); if (!txt) return;
      const s2 = st(id); s2.notes = s2.notes || []; s2.notes.push({ id: 'n' + Date.now(), type: body.querySelector('#note-type').value, body: txt, at: Date.now() }); S.items[id] = s2; save(); openItem(id); toast('Note added');
    });
    const rf = body.querySelector('#rubricform');
    if (rf) rf.addEventListener('submit', (e) => {
      e.preventDefault(); const vals = D.rubric.map((_, i) => +rf.elements['r' + i].value); const total = vals.reduce((a, b) => a + b, 0);
      const s2 = st(id); s2.scores = s2.scores || []; s2.scores.push({ at: Date.now(), vals, total }); S.items[id] = s2; save();
      if (total >= 10 && s2.status !== 'done' && s2.status !== 'mastered') setStatus(id, 'done');
      openItem(id); refresh();
      const weak = D.rubric.filter((_, i) => vals[i] === 0);
      toast('Scored ' + total + '/14.' + (weak.length ? ' Work on: ' + weak[0] + '.' : ' Strong attempt.'));
    });
    if (!dlg.open) dlg.showModal();
  }

  // ---------- log dialog ----------
  function itemOptions(track, sel) {
    const tl = track === 'dsa' ? D.dsaTopics : track === 'sql' ? libTopics.filter((t) => t.track === 'sql') : [...D.sdTopics, ...libTopics.filter((t) => t.track === 'sd')];
    return '<option value="">No specific item</option>' + tl.map((t) => '<optgroup label="' + esc(t.code + ' ' + t.name) + '">' + D.items.filter((i) => i.topic === t.code).map((i) => '<option value="' + i.id + '"' + (i.id === sel ? ' selected' : '') + '>' + esc(i.title) + '</option>').join('') + '</optgroup>').join('');
  }
  function openLog(o) {
    const f = document.getElementById('logform'); const track = o.track || 'sd'; const it = byId[o.itemId]; const cur = it ? st(it.id).status : 'not_started';
    const defAct = track === 'sql' ? 'read' : track === 'sd' && it && it.lib && it.type === 'lesson' ? 'lesson' : track === 'sd' ? (it && (it.type === 'case' || it.type === 'libcase') ? (L().sdMode === 'case-full' ? 'full' : 'practise') : (L().n === 1 ? 'watch' : 'summarise')) : 'solve';
    f.innerHTML = '<div class="dlg-head"><h2 id="logdlg-title">Log ' + (track === 'sd' ? 'system design' : TRACK[track]) + ' time</h2><button class="btn quiet" type="button" data-close aria-label="Close">Close</button></div>' +
      '<div class="row"><div class="field"><label for="lg-track">Track</label><select id="lg-track"><option value="sd"' + (track === 'sd' ? ' selected' : '') + '>System design</option><option value="dsa"' + (track === 'dsa' ? ' selected' : '') + '>DSA</option><option value="sql"' + (track === 'sql' ? ' selected' : '') + '>SQL (does not count towards the day)</option></select></div><div class="field"><label for="lg-min">Minutes</label><input id="lg-min" type="number" min="1" max="600" value="' + (o.minutes || 15) + '" required></div><div class="field"><label for="lg-date">Study day</label><input id="lg-date" type="date" value="' + today() + '"></div></div>' +
      '<div class="field"><label for="lg-item">Question or topic</label><select id="lg-item">' + itemOptions(track, o.itemId) + '</select></div>' +
      '<div class="row"><div class="field"><label for="lg-act">What you did</label><select id="lg-act">' + ACTIVITY[track].map(([v, l]) => '<option value="' + v + '"' + (v === defAct ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div><div class="field"><label for="lg-status">Status after this session</label><select id="lg-status">' + STATUS[track].map(([v, l]) => '<option value="' + v + '"' + (v === (cur === 'not_started' ? (track === 'dsa' ? 'solved' : 'in_progress') : cur) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
      (track === 'sd' ? '<div class="field"><label for="lg-part">Design part (for design cases)</label><select id="lg-part"><option value="">Not a design case part</option>' + PARTS.map((p) => '<option' + (p === o.part ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></div>' : '') +
      '<div class="field"><label for="lg-note">One note (optional)</label><textarea id="lg-note" placeholder="What worked, what you missed"></textarea></div>' +
      '<p class="small muted">Counts towards today when it is ' + minNow() + ' minutes or more.</p>' +
      '<div class="actions"><button class="btn primary" type="submit" value="save">Save session</button>' + (o.fromTimer ? '<button class="btn" type="button" data-discard>Discard timer</button>' : '') + '</div>';
    f.dataset.fromTimer = o.fromTimer ? '1' : '';
    f.querySelector('#lg-track').addEventListener('change', (e) => openLog({ ...o, track: e.target.value, itemId: null, minutes: +f.querySelector('#lg-min').value }));
    f.querySelector('#lg-item').addEventListener('change', (e) => { const s2 = e.target.value ? st(e.target.value).status : 'not_started'; if (s2 !== 'not_started') f.querySelector('#lg-status').value = s2; });
    const d = document.getElementById('logdlg'); if (!d.open) d.showModal();
  }
  function saveLog(f) {
    const track = f.querySelector('#lg-track').value;
    const minutes = Math.max(1, Math.min(600, parseInt(f.querySelector('#lg-min').value, 10) || 0));
    const itemId = f.querySelector('#lg-item').value || null;
    const date = f.querySelector('#lg-date').value || today();
    const sess = { id: 's' + Date.now(), date, track, itemId, minutes, min: minNow(), activity: f.querySelector('#lg-act').value, part: (f.querySelector('#lg-part') || {}).value || '', source: f.dataset.fromTimer ? 'timer' : 'manual', at: Date.now() };
    const before = dayInfo(date).status;
    S.sessions.push(sess);
    if (itemId) {
      setStatus(itemId, f.querySelector('#lg-status').value);
      const txt = f.querySelector('#lg-note').value.trim();
      if (txt) { const s2 = st(itemId); s2.notes = s2.notes || []; s2.notes.push({ id: 'n' + Date.now(), type: 'Approach', body: txt, at: Date.now(), session: sess.id }); S.items[itemId] = s2; }
    }
    save();
    if (f.dataset.fromTimer) setT(null);
    document.getElementById('logdlg').close();
    const after = dayInfo(date).status;
    showCoachCard(coachReaction(sess, before, after));
    if (after === 'ok' && before !== 'ok') releaseBalloons(7, ['family'], true);
    checkProgress(); tick(); refresh();
  }

  // ---------- global events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.open) { e.preventDefault(); openItem(t.dataset.open); }
    else if (t.hasAttribute('data-close')) { t.closest('dialog').close(); }
    else if (t.dataset.start) { startTimer(t.dataset.start, t.dataset.item || null, { part: t.dataset.part || '' }); }
    else if (t.dataset.startItem) { const it = byId[t.dataset.startItem]; document.getElementById('itemdlg').close(); startTimer(it.track, it.id, { part: it.type === 'case' ? nextPart(it.id) || '' : '' }); }
    else if (t.dataset.logItem) { const it = byId[t.dataset.logItem]; document.getElementById('itemdlg').close(); openLog({ track: it.track, itemId: it.id }); }
    else if (t.dataset.log) { openLog({ track: t.dataset.log, itemId: t.dataset.item || null }); }
    else if (t.dataset.act === 'pause') pauseTimer();
    else if (t.dataset.act === 'stop') stopTimer();
    else if (t.hasAttribute('data-discard')) { setT(null); document.getElementById('logdlg').close(); tick(); refresh(); toast('Timer discarded'); }
    else if (t.dataset.pin) { const id = document.getElementById('itemdlg').dataset.id; const s = st(id); s.pinned = t.dataset.pin; S.items[id] = s; save(); openItem(id); }
    else if (t.dataset.delnote) { const id = document.getElementById('itemdlg').dataset.id; const s = st(id); s.notes = s.notes.filter((n) => n.id !== t.dataset.delnote); if (s.pinned === t.dataset.delnote) s.pinned = null; S.items[id] = s; save(); openItem(id); }
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'logform') { e.preventDefault(); saveLog(e.target); } });

  // ---------- pages ----------
  let refresh = () => {};

  function taskNode(track, info, tgt) {
    const mins = track === 'dsa' ? info.dsa : info.sd;
    const done = track === 'dsa' ? info.dsaDone : info.sdDone;
    const t = getT(); const running = t && t.track === track;
    const cls = done ? 's-ok' : running ? 's-run' : mins > 0 ? 's-part' : '';
    const label = done ? 'Done' : running ? 'Running' : mins > 0 ? 'Keep going' : 'Not started';
    const sug = suggest(track);
    const pct = Math.min(100, Math.round((mins / tgt) * 100));
    return '<article class="task ' + cls + '"><header><h2>' + (track === 'sd' ? 'System design' : 'DSA') + '</h2><span class="state">' + label + '</span></header>' +
      '<p class="mins">' + mins + ' <span>of ' + tgt + ' min</span></p><div class="bar" role="img" aria-label="' + pct + ' percent of target"><i style="width:' + pct + '%"></i></div>' +
      (sug ? '<p class="next">' + sug.why + ': <button class="linkish" data-open="' + sug.item.id + '">' + esc(sug.item.title) + '</button> <span class="muted small">' + esc(topicBy[sug.item.topic].name) + (sug.item.diff ? ', ' + sug.item.diff : '') + '</span></p><p class="how small">' + esc(sug.how) + '</p>' : '<p class="next muted">Every item started. Pick one to revise.</p>') +
      '<div class="actions"><button class="btn primary" data-start="' + track + '"' + (sug ? ' data-item="' + sug.item.id + '"' + (sug.part ? ' data-part="' + esc(sug.part) + '"' : '') : '') + (t ? ' disabled' : '') + '>Start timer</button><button class="btn" data-log="' + track + '"' + (sug ? ' data-item="' + sug.item.id + '"' : '') + '>Log time</button></div></article>';
  }

  function runGrid(weeks) {
    const t = today(); const end = addDays(t, 6 - ((dow(t) + 6) % 7)); const days = weeks * 7; const first = firstDay();
    let html = '<div class="rungrid" role="img" aria-label="Daily history for the last ' + weeks + ' weeks"><span></span><span class="rl">System design</span><span class="rl">DSA</span><span class="rl">Day</span>';
    let lastMonth = '';
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(end, -i); const fut = d > t; const info = fut ? null : dayInfo(d);
      if (info && d < first && info.status === 'miss') info.status = '';
      const [y, m] = d.split('-');
      const mo = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
      const showMo = mo !== lastMonth && Number(d.slice(8)) <= 7 && dow(d) === 1; if (showMo) lastMonth = mo;
      const trackCls = (done, min) => (done ? 'ok' : min > 0 ? 'part' : info.status === 'rest' ? 'rest' : '');
      const title = fut ? d : d + ': system design ' + info.sd + ' min, DSA ' + info.dsa + ' min';
      html += '<span class="mo">' + (showMo ? mo : '') + '</span>' +
        '<span class="cell ' + (fut ? 'future' : trackCls(info.sdDone, info.sd)) + '" title="' + title + '"></span>' +
        '<span class="cell ' + (fut ? 'future' : trackCls(info.dsaDone, info.dsa)) + '" title="' + title + '"></span>' +
        '<span class="cell ' + (fut ? 'future' : info.status) + (d === t ? ' today' : '') + '" title="' + title + '"></span>';
    }
    return html + '</div>';
  }
  const legend = '<div class="legend"><span><i class="cell ok"></i>Done</span><span><i class="cell part"></i>Some time, under minimum</span><span><i class="cell rest"></i>Rest day</span><span><i class="cell miss"></i>Missed day</span><span><i class="cell"></i>Nothing logged</span></div>';
  function drawGrid(weeks) { const g = document.getElementById('grid'); g.innerHTML = '<div class="gridscroll">' + runGrid(weeks) + '</div>' + legend; const gw = g.querySelector('.gridscroll'); gw.scrollLeft = gw.scrollWidth; }

  function whyStrip() {
    const p = S.profile; const n = daughter();
    const left = p.targetDate ? daysBetween(today(), p.targetDate) : null;
    const hrs = Math.round(totalMinutes() / 6) / 10; const sk = streak();
    const c = coachMessage();
    return '<div class="coach"><span class="coach-av" aria-hidden="true">' + MARK + '</span><div class="coach-text"><p class="coach-label">Your coach</p><p class="coach-head">' + esc(c.head) + '</p><p class="coach-body">' + esc(c.body) + '</p></div></div>' +
      dayStrip() +
      '<p class="why-line">' + (p.why ? (n ? '<span>For ' + esc(n) + '</span> ' : '<span>Your why</span> ') + esc(p.why) : '<a href="why.html">Write your why</a>: her name, and what this job changes for her.') + '</p>' +
      '<div class="stats-row"><div class="stat hl"><b>' + sk + '</b><span>day streak</span></div>' +
      (left !== null && left >= 0 ? '<div class="stat"><b>' + left + '</b><span>days to the offer</span></div>' : '<div class="stat"><b>—</b><span>set an offer date</span></div>') +
      '<div class="stat"><b>' + hrs + '</b><span>of ' + p.hoursGoal + ' prep hours</span></div><div class="stat"><b>L' + L().n + '</b><span>' + (S.settings.levelMode === 'manual' ? 'custom targets' : esc(L().name.toLowerCase())) + '</span></div></div>';
  }
  function levelCard() {
    const lv = L();
    if (S.settings.levelMode === 'manual') return '<div class="lvl"><p><b>Custom targets.</b> <a href="settings.html">Back to the habit ladder</a></p></div>';
    if (lv.n === 4) return '<div class="lvl"><p><b>Level 4, interview pace.</b> Keep the streak, keep scoring cases.</p></div>';
    const done = completeSince(S.settings.levelSince); const pct = Math.min(100, Math.round((done / lv.need) * 100));
    return '<div class="lvl"><p><b>' + done + ' of ' + lv.need + ' complete days</b> to unlock level ' + (lv.n + 1) + ', ' + D.levels[lv.n].name.toLowerCase() + '.</p><div class="bar" role="img" aria-label="' + pct + ' percent to next level"><i style="width:' + pct + '%"></i></div></div>';
  }

  function renderHome() {
    const t = today(); const info = dayInfo(t); const tg = targets(t); const s = streak();
    document.getElementById('today-date').textContent = niceDate(t);
    const nx = nextMilestone();
    const fz = focusNow();
    document.getElementById('why').innerHTML = whyStrip() + levelCard() + (fz ? '<p class="next-ms">🎯 Month ' + fz.month + ' focus: <b>' + esc(fz.title) + '</b> · <a href="career.html">your plan</a></p>' : '') + (nx ? '<p class="next-ms">🏅 Next milestone: <b>' + esc(nx) + '</b> · <a href="progress.html#milestones">see all</a></p>' : '');
    const late = new Date().getHours() >= 21 && info.status !== 'ok' && !S.rest.includes(t);
    let banner = '';
    if (missedYesterday()) banner = '<div class="banner"><b>Never miss twice.</b> Yesterday slipped, and that is fine. Do the ' + minNow() + '-minute version of each task today and the habit stays alive.</div>';
    else if (late) banner = '<div class="banner"><b>Late, but not too late.</b> ' + minNow() + ' minutes on whatever is left still completes today.</div>';
    const rdue = retroDue();
    if (rdue) banner = '<div class="banner"><b>Your weekly retrospective is ready.</b> Three questions about the week of ' + shortDate(rdue) + ', three minutes. <button class="btn small primary" data-retro="' + rdue + '" type="button">Start</button></div>' + banner;
    document.getElementById('banner').innerHTML = banner;
    const endTxt = { ok: ['Complete', 'Both done. Close the laptop and go be with family.'], part: ['One to go', 'Even ' + minNow() + ' minutes on the other task completes today.'], miss: ['Not started', 'Start with system design. ' + minNow() + ' minutes is enough to count.'], rest: ['Rest day', 'Streak kept. Back tomorrow.'] }[info.status];
    document.getElementById('run').innerHTML = taskNode('sd', info, tg.sd) + '<div class="edge" aria-hidden="true"></div>' + taskNode('dsa', info, tg.dsa) + '<div class="edge" aria-hidden="true"></div>' +
      '<div class="dayend' + (info.status === 'ok' ? ' done' : '') + '"><span class="muted small">Day result</span><strong>' + endTxt[0] + '</strong><span class="small muted">' + endTxt[1] + '</span>' +
      (info.status !== 'ok' && !S.rest.includes(t) && restUsedThisWeek() < S.settings.restPerWeek ? '<button class="btn quiet small" id="userest" style="align-self:start">Use rest day</button>' : '') + '</div>';
    const ur = document.getElementById('userest'); if (ur) ur.onclick = () => { S.rest.push(t); save(); renderHome(); toast('Rest day used. The streak is safe.'); };
    drawGrid(12);
    const due = dueItems();
    document.getElementById('due').innerHTML = due.length ? due.slice(0, 8).map((i) => { const s2 = st(i.id); const key = (s2.notes || []).find((n) => n.id === s2.pinned); return '<li><span><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (key ? '<span class="muted small" style="display:block">' + esc(key.body.slice(0, 110)) + '</span>' : '') + '</span><span class="chip st-' + s2.status + '">' + STATUS_LABEL[s2.status] + '</span></li>'; }).join('') : '<li class="muted">Nothing due. Items come back here 1 to 30 days after you set their status.</li>';
    tick();
  }
  function initHome() {
    refresh = renderHome; renderHome();
    if (S.burstDay !== today()) { S.burstDay = today(); save(); setTimeout(() => releaseBalloons(5, null, false), 900); }
    const q = new URLSearchParams(location.search).get('start');
    if (q === 'sd' || q === 'dsa') {
      history.replaceState(null, '', location.pathname);
      if (!getT()) { const sug = suggest(q); startTimer(q, sug ? sug.item.id : null, { noOpen: true, part: sug && sug.part || '' }); }
    }
  }

  function renderList(track) {
    const tps = track === 'dsa' ? D.dsaTopics : D.sdTopics;
    const f = { q: document.getElementById('f-q').value.toLowerCase(), topic: document.getElementById('f-topic').value, status: document.getElementById('f-status').value, diff: (document.getElementById('f-diff') || {}).value || '' };
    let out = '';
    tps.forEach((t) => {
      if (f.topic && f.topic !== t.code) return;
      const all = D.items.filter((i) => i.topic === t.code);
      const rows = all.filter((i) => {
        const s = st(i.id).status;
        if (f.q && !(i.title + ' ' + i.text + ' ' + (i.angle || '')).toLowerCase().includes(f.q)) return false;
        if (f.status === 'due') return isDue(i.id);
        if (f.status && s !== f.status) return false;
        if (f.diff && i.diff !== f.diff) return false;
        return true;
      });
      if (!rows.length) return;
      const doneN = all.filter((i) => ['solved', 'done', 'mastered'].includes(st(i.id).status)).length;
      const mins = all.reduce((a, i) => a + minutesFor(i.id), 0);
      const gp = gapFor(t.code);
      out += '<section class="topic' + (gp ? ' gap' : '') + '"><div class="topic-head"><h2><span class="code">' + t.code + '</span>' + esc(t.name) + (gp ? ' <span class="gapchip">Your gap</span>' : '') + '</h2><div class="topic-meta"><span class="prio">P' + t.priority + '</span><span>' + doneN + ' of ' + all.length + ' done</span><span>' + fmtH(mins) + '</span></div></div><p class="topic-why">' + esc(gp ? gp.why : t.why) + '</p><table class="qtable"><tbody>' +
        rows.map((i) => {
          const s = st(i.id);
          const src = i.links.length ? i.links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.p) + '</a>').join(' ') : (i.track === 'sd' ? '<a href="https://www.youtube.com/results?search_query=' + encodeURIComponent(i.title + ' data engineering system design') + '" target="_blank" rel="noopener">Find a video</a>' : '<span class="muted">Question only</span>');
          const sc = (s.scores || []).length ? ' <span class="chip">' + s.scores[s.scores.length - 1].total + '/14</span>' : '';
          const ex = expFor(i.id);
          return '<tr><td class="t"><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (ex ? '<span class="angle mine">You built this: ' + esc(ex.from) + '</span>' : '') + (i.angle ? '<span class="angle">' + esc(i.angle) + '</span>' : '') + (i.fits && i.fits.length ? '<span class="angle fits">Fits: ' + i.fits.join(', ') + '</span>' : '') + '</td>' +
            '<td class="hide-sm">' + (i.diff ? '<span class="diff ' + i.diff + '">' + i.diff + '</span>' : '<span class="muted small">' + (i.type === 'case' ? 'Design case' : 'Concept') + '</span>') + '</td>' +
            '<td class="src hide-sm">' + src + '</td><td><span class="chip st-' + s.status + '">' + STATUS_LABEL[s.status] + '</span>' + sc + (isDue(i.id) ? ' <span class="chip due">Due</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    });
    document.getElementById('list').innerHTML = out || '<p class="muted">No items match these filters. Clear the search or pick another status.</p>';
  }
  function initList(track) {
    const tps = track === 'dsa' ? D.dsaTopics : D.sdTopics;
    document.getElementById('f-topic').innerHTML = '<option value="">All topics</option>' + tps.map((t) => '<option value="' + t.code + '">' + t.code + ' ' + esc(t.name) + '</option>').join('');
    document.getElementById('f-status').innerHTML = '<option value="">Any status</option><option value="due">Due for revision</option>' + STATUS[track].map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
    const cnt = document.getElementById('count'); if (cnt) cnt.textContent = D.items.filter((i) => i.track === track).length;
    ['f-q', 'f-topic', 'f-status', 'f-diff'].forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => renderList(track)); });
    refresh = () => renderList(track); renderList(track);
  }

  function renderLib() {
    const f = { q: document.getElementById('f-q').value.toLowerCase(), g: document.getElementById('f-group').value, tier: document.getElementById('f-tier').value, status: document.getElementById('f-status').value };
    const showTier = (t) => f.tier === 'all' || (f.tier === 'core' && (t === 'must' || t === 'useful')) || f.tier === t;
    const all = D.items.filter((i) => i.lib);
    const must = all.filter((i) => i.tier === 'must'); const mustDone = must.filter((i) => ['done', 'mastered'].includes(st(i.id).status)).length;
    const libMin = all.reduce((a, i) => a + minutesFor(i.id), 0);
    document.getElementById('libstats').innerHTML = '<div class="stat hl"><b>' + mustDone + '/' + must.length + '</b><span>must-do lessons done</span></div><div class="stat"><b>' + all.filter((i) => st(i.id).status !== 'not_started').length + '</b><span>lessons started</span></div><div class="stat"><b>' + all.filter((i) => isDue(i.id)).length + '</b><span>due for revision</span></div><div class="stat"><b>' + fmtH(libMin) + '</b><span>time in the course</span></div>';
    let out = '';
    libTopics.forEach((t) => {
      if (f.g && f.g !== t.code) return;
      const its = all.filter((i) => i.topic === t.code);
      const rows = its.filter((i) => {
        if (!showTier(i.tier)) return false;
        if (f.q && !(i.title + ' ' + i.text).toLowerCase().includes(f.q)) return false;
        if (f.status === 'due') return isDue(i.id);
        if (f.status && st(i.id).status !== f.status) return false;
        return true;
      });
      if (!rows.length) return;
      const done = its.filter((i) => ['done', 'mastered'].includes(st(i.id).status)).length; const pct = Math.round((done / its.length) * 100);
      out += '<section class="topic"><div class="topic-head"><h2><span class="code">' + t.code + '</span>' + esc(t.name) + '</h2><div class="topic-meta"><span>' + done + ' of ' + its.length + ' done</span><span>' + fmtH(its.reduce((a, i) => a + minutesFor(i.id), 0)) + '</span></div></div>' +
        '<div class="bar" style="margin:10px 0 6px" role="img" aria-label="' + pct + ' percent done"><i style="width:' + pct + '%"></i></div><table class="qtable"><tbody>' +
        rows.map((i) => { const s = st(i.id); return '<tr><td class="t"><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (i.text ? '<span class="angle">' + esc(i.text.replace('Why it matters for staff DE: ', '')) + '</span>' : '') + '</td>' +
          '<td class="hide-sm"><span class="tier tier-' + i.tier + '">' + TIER[i.tier] + '</span></td><td class="src">' + i.links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + (l.p === 'Aced' ? (LIB.offline ? 'Aced' : 'Open') : l.p === 'Offline copy' ? 'Offline' : esc(l.p)) + '</a>').join(' · ') + '</td>' +
          '<td><span class="chip st-' + s.status + '">' + STATUS_LABEL[s.status] + '</span>' + (isDue(i.id) ? ' <span class="chip due">Due</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></section>';
    });
    document.getElementById('list').innerHTML = out || '<p class="muted">No lessons match these filters.</p>';
  }
  function initLib() {
    document.getElementById('f-group').innerHTML = '<option value="">All modules</option>' + libTopics.map((t) => '<option value="' + t.code + '">' + t.code + ' ' + esc(t.name) + '</option>').join('');
    document.getElementById('f-status').innerHTML = '<option value="">Any status</option><option value="due">Due for revision</option>' + STATUS.sd.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
    ['f-q', 'f-group', 'f-tier', 'f-status'].forEach((id) => document.getElementById(id).addEventListener('input', renderLib));
    refresh = renderLib; renderLib();
  }

  function renderProgress() {
    const t = today();
    const range = (from) => S.sessions.filter((s) => s.date >= from && s.date <= t);
    const sum = (arr, tr) => arr.filter((s) => !tr || s.track === tr).reduce((a, s) => a + s.minutes, 0);
    const wk = range(addDays(t, -((dow(t) + 6) % 7)));
    let complete = 0; for (let i = 0; i < 28; i++) if (dayInfo(addDays(t, -i)).status === 'ok') complete++;
    const ws = sum(wk, 'sd'), wd = sum(wk, 'dsa');
    const allScores = D.items.flatMap((i) => (st(i.id).scores || []).map((x) => ({ ...x, id: i.id }))).sort((a, b) => b.at - a.at);
    const avg = allScores.length ? (allScores.slice(0, 5).reduce((a, x) => a + x.total, 0) / Math.min(5, allScores.length)).toFixed(1) : null;
    document.getElementById('kpis').innerHTML =
      '<div class="kpi"><div class="v">' + fmtH(ws + wd) + '</div><div class="l">This week</div></div>' +
      '<div class="kpi"><div class="v">' + Math.round(totalMinutes() / 6) / 10 + ' h</div><div class="l">Total, goal ' + S.profile.hoursGoal + ' h</div></div>' +
      '<div class="kpi"><div class="v">' + complete + ' / 28</div><div class="l">Complete days, last 4 weeks</div></div>' +
      '<div class="kpi"><div class="v">' + streak() + '</div><div class="l">Current streak</div></div>' +
      '<div class="kpi"><div class="v">' + (avg ? avg + '/14' : 'none') + '</div><div class="l">Design rubric, last 5 scores</div></div>' +
      '<div class="kpi"><div class="v">L' + L().n + '</div><div class="l">' + (S.settings.levelMode === 'manual' ? 'Custom targets' : L().name) + '</div></div>';
    const tot = ws + wd || 1;
    document.getElementById('split').innerHTML = '<p class="coach-week">' + (ws + wd ? 'This week you gave ' + fmtH(ws + wd) + ' to ' + her() + '’s future: ' + fmtH(ws) + ' of system design, ' + fmtH(wd) + ' of DSA.' + (ws < wd ? ' Shift a little more to system design; it decides staff offers.' : '') : 'Nothing logged this week yet. Ten minutes today changes that.') + '</p><div class="splitbar" role="img" aria-label="System design ' + Math.round((ws / tot) * 100) + ' percent"><span class="a" style="width:' + (ws / tot) * 100 + '%"></span><span class="b" style="width:' + (wd / tot) * 100 + '%"></span></div>';
    drawGrid(16);
    renderGrowth();
    document.getElementById('topics').innerHTML = '<table class="dtable"><thead><tr><th>Topic</th><th class="num">Items</th><th class="num">Done</th><th class="num">Due</th><th class="num">Time</th></tr></thead><tbody>' +
      topics.map((tp) => { const its = D.items.filter((i) => i.topic === tp.code); const mins = its.reduce((a, i) => a + minutesFor(i.id), 0); return '<tr><td>' + tp.code + ' ' + esc(tp.name) + ' <span class="muted small">P' + tp.priority + '</span></td><td class="num">' + its.length + '</td><td class="num">' + its.filter((i) => ['solved', 'done', 'mastered'].includes(st(i.id).status)).length + '</td><td class="num">' + its.filter((i) => isDue(i.id)).length + '</td><td class="num">' + (mins ? fmtH(mins) : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    const recent = S.sessions.slice().sort((a, b) => b.at - a.at).slice(0, 40);
    document.getElementById('sessions').innerHTML = recent.length ? '<table class="dtable"><thead><tr><th>Day</th><th>Track</th><th>Item</th><th>Activity</th><th class="num">Minutes</th><th></th></tr></thead><tbody>' +
      recent.map((s) => '<tr><td>' + s.date + '</td><td>' + TRACK[s.track] + '</td><td>' + (byId[s.itemId] ? '<button class="linkish" data-open="' + s.itemId + '">' + esc(byId[s.itemId].title) + '</button>' : '<span class="muted">—</span>') + (s.part ? ' <span class="muted small">(' + esc(s.part) + ')</span>' : '') + '</td><td>' + esc((ACTIVITY[s.track].find((a) => a[0] === s.activity) || ['', s.activity])[1]) + '</td><td class="num">' + s.minutes + '</td><td><button class="linkish small" data-delsess="' + s.id + '">Delete</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted">No sessions yet. Start a timer on <a href="index.html">Today</a> or log time manually.</p>';
  }
  function initProgress() {
    refresh = renderProgress; renderProgress();
    if (new URLSearchParams(location.search).get('retro')) { history.replaceState(null, '', location.pathname); setTimeout(() => openRetro(), 300); }
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-delsess]'); if (b && confirm('Delete this session?')) { S.sessions = S.sessions.filter((s) => s.id !== b.dataset.delsess); save(); renderProgress(); } });
    document.getElementById('export').onclick = () => { if (BR) { if (!BR.saveFile('dataleap-backup-' + today() + '.json', 'application/json', JSON.stringify(S, null, 2))) toast('Could not save the backup.'); return; } const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dataleap-backup-' + today() + '.json'; a.click(); };
    document.getElementById('import').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return; const r = new FileReader();
      r.onload = () => { try { const d = JSON.parse(r.result); if (!d.sessions || !d.items) throw 0; localStorage.setItem(KEY, JSON.stringify(d)); S = load(); save(); renderProgress(); toast('Backup restored'); } catch (err) { toast('That file is not a DataLeap backup.'); } };
      r.readAsText(file);
    };
  }

  // ---------- My why ----------
  function renderWhyView() {
    const p = S.profile; const n = daughter() || 'my daughter'; const v = p.vision;
    const left = p.targetDate ? daysBetween(today(), p.targetDate) : null;
    const list = (arr) => '<ul>' + arr.filter(Boolean).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    document.getElementById('whyview').innerHTML =
      '<h1>' + (p.why ? esc(p.why) : 'Why I am doing this') + '</h1>' +
      '<p class="lede">' + esc(p.role) + ' at ' + esc(p.companies) + (p.targetDate ? '. Offer by ' + esc(niceDate(p.targetDate)) + (left !== null && left >= 0 ? ', ' + left + ' days from now' : '') : '') + '.</p>' +
      '<div class="vision"><section><h2>For ' + esc(n) + '</h2>' + list(v.daughter) + '</section><section><h2>For our family</h2>' + list(v.family) + '</section><section><h2>For me</h2>' + list(v.me) + '</section></div>' +
      (p.letter ? '<section class="letter"><h2>A letter to ' + esc(n) + ', to read on offer day</h2><p>' + esc(p.letter).replace(/\n/g, '<br>') + '</p></section>' : '') +
      '<p class="note">Read this when you feel like skipping. Then start the timer for ' + minNow() + ' minutes. That is all today needs.</p>';
  }
  function initWhy() {
    const f = document.getElementById('whyform'); const p = S.profile;
    ['me', 'years', 'name', 'why', 'role', 'companies', 'targetDate', 'hoursGoal', 'letter'].forEach((k) => { f.elements[k].value = p[k] || ''; });
    ['daughter', 'family', 'me'].forEach((k) => { f.elements['v-' + k].value = (p.vision[k] || []).join('\n'); });
    f.onsubmit = (e) => {
      e.preventDefault();
      ['me', 'name', 'why', 'role', 'companies', 'targetDate', 'letter'].forEach((k) => { p[k] = f.elements[k].value.trim(); });
      p.hoursGoal = Math.max(10, parseInt(f.elements.hoursGoal.value, 10) || 250);
      p.years = Math.max(1, Math.min(40, parseInt(f.elements.years.value, 10) || 10));
      ['daughter', 'family', 'me'].forEach((k) => { p.vision[k] = f.elements['v-' + k].value.split('\n').map((x) => x.trim()).filter(Boolean); });
      save(); renderWhyView(); document.getElementById('quote-text').textContent = quoteFor('why', quoteShift); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Saved. This is why.');
    };
    renderWhyView();
  }

  // ---------- settings ----------
  function icsFor(reminders) {
    const D2 = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const site = location.href.replace(/[^/]*$/, '');
    const now = new Date(); const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DataLeap//Reminders//EN', 'CALSCALE:GREGORIAN'];
    reminders.filter((r) => r.on).forEach((r, i) => {
      const [h, m] = r.time.split(':');
      const d = new Date(); d.setDate(d.getDate() + 1);
      const ds = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
      const quote = personal(D.quotes[r.focus === 'dsa' ? 'dsa' : r.focus === 'sd' ? 'sd' : 'family'][i % 5]).replace(/[,;\\]/g, (c) => '\\' + c);
      const msg = r.msg.replace(/[,;\\]/g, (c) => '\\' + c);
      const url = site + 'index.html' + (r.focus === 'either' ? '' : '?start=' + r.focus);
      lines.push('BEGIN:VEVENT', 'UID:dataleap-' + r.id + '-' + stamp + '@dataleap', 'DTSTAMP:' + stamp, 'DTSTART:' + ds + 'T' + h + m + '00', 'DURATION:PT15M',
        'RRULE:FREQ=WEEKLY;BYDAY=' + r.days.map((x) => D2[x]).join(','), 'SUMMARY:DataLeap: ' + msg, 'DESCRIPTION:' + quote + '\\n\\nOpen DataLeap: ' + url, 'URL:' + url,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + msg, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function initSettings() {
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const FOCUS = { either: 'Either', dsa: 'DSA', sd: 'System design', family: 'Family', sleep: 'Sleep' };
    function renderRem() {
      document.getElementById('remlist').innerHTML = S.reminders.length ? '<table class="dtable"><thead><tr><th>Time</th><th>Days</th><th>Focus</th><th>Message</th><th>Rules</th><th></th></tr></thead><tbody>' +
        S.reminders.slice().sort((a, b) => a.time.localeCompare(b.time)).map((r) => '<tr><td><b>' + r.time + '</b></td><td>' + (r.days.length === 7 ? 'Every day' : r.days.length === 5 && !r.days.includes(0) && !r.days.includes(6) ? 'Weekdays' : r.days.map((d) => DAYS[d]).join(' ')) + '</td><td>' + FOCUS[r.focus] + '</td><td>' + esc(r.msg) + '</td><td class="small muted">' + [r.skip ? 'Skips when done' : '', r.last ? 'Last call' : ''].filter(Boolean).join(', ') + '</td><td style="white-space:nowrap"><label class="small inline"><input type="checkbox" data-remon="' + r.id + '"' + (r.on ? ' checked' : '') + '> On</label> <button class="linkish small" data-remdel="' + r.id + '">Delete</button></td></tr>').join('') + '</tbody></table>'
        : '<p class="muted">No reminders. Add one below; three works well: morning, lunch and night.</p>';
    }
    renderRem();
    document.getElementById('remlist').addEventListener('change', (e) => { const id = e.target.dataset.remon; if (id) { S.reminders.find((r) => r.id === id).on = e.target.checked; save(); } });
    document.getElementById('remlist').addEventListener('click', (e) => { const id = e.target.dataset && e.target.dataset.remdel; if (id) { S.reminders = S.reminders.filter((r) => r.id !== id); save(); renderRem(); } });
    const rf = document.getElementById('remform');
    rf.onsubmit = (e) => {
      e.preventDefault();
      if (S.reminders.length >= 12) { toast('Up to 12 reminders. Delete one first.'); return; }
      const days = [...rf.querySelectorAll('input[name=day]:checked')].map((x) => +x.value);
      if (!days.length) { toast('Pick at least one day.'); return; }
      S.reminders.push({ id: 'r' + Date.now(), time: rf.elements.time.value, days, focus: rf.elements.focus.value, msg: rf.elements.msg.value.trim() || 'Time to prep', skip: rf.elements.skip.checked, last: rf.elements.last.checked, on: true });
      save(); renderRem(); rf.reset(); toast('Reminder added');
    };
    if (BR) {
      const np = document.getElementById('notifpanel');
      const drawNative = () => {
        const on = BR.notificationsEnabled(); const ex = BR.exactAlarms();
        np.innerHTML = '<h2>Reminders on this phone</h2><p>Your reminders are real Android alarms. They fire on time even when DataLeap is closed, skip themselves once that part of the day is done, and come back after a restart.</p>' +
          '<ul class="nativestat"><li><span class="chip ' + (on ? 'st-done' : 'st-not_solved') + '">' + (on ? 'On' : 'Off') + '</span> Notifications' + (on ? '' : ' <button class="btn small" id="n-open" type="button">Turn on</button>') + '</li>' +
          '<li><span class="chip ' + (ex ? 'st-done' : 'st-with_help') + '">' + (ex ? 'On' : 'Off') + '</span> Exact timing' + (ex ? '' : ' <button class="btn small" id="x-open" type="button">Allow</button> <span class="small muted">Without it, reminders may arrive a few minutes late.</span>') + '</li></ul>' +
          '<p class="actions"><button class="btn primary" id="n-test" type="button">Send a test reminder</button></p>' +
          '<h3 style="margin-top:18px">Morning motivation</h3><p class="small">Besides your reminders, DataLeap sends a few motivating lines at different times each day, so the day starts with your why. They stop once the day is complete. On Sunday evening you also get a summary of your week.</p>' +
          '<form id="motivform"><div class="row"><div class="field" style="flex:0 0 auto"><label class="inline"><input type="checkbox" name="on"' + (S.settings.motiv.on ? ' checked' : '') + '> On</label></div>' +
          '<div class="field"><label for="mo-count">How many a day</label><select id="mo-count" name="count"><option value="3"' + (S.settings.motiv.count == 3 ? ' selected' : '') + '>3</option><option value="4"' + (S.settings.motiv.count == 4 ? ' selected' : '') + '>4</option></select></div>' +
          '<div class="field"><label for="mo-start">From</label><input id="mo-start" name="start" type="time" value="' + S.settings.motiv.start + '"></div>' +
          '<div class="field"><label for="mo-end">Until</label><input id="mo-end" name="end" type="time" value="' + S.settings.motiv.end + '"></div></div>' +
          '<label class="inline" style="margin-bottom:12px"><input type="checkbox" name="weekly"' + (S.settings.motiv.weekly ? ' checked' : '') + '> Weekly summary on Sunday at 7 pm</label><br><button class="btn" type="submit">Save</button></form>';
        const o = document.getElementById('n-open'); if (o) o.onclick = () => BR.openNotificationSettings();
        const x = document.getElementById('x-open'); if (x) x.onclick = () => BR.openExactAlarmSettings();
        document.getElementById('n-test').onclick = () => { BR.testNotification(); toast('Test reminder sent'); };
        document.getElementById('motivform').onsubmit = (e) => {
          e.preventDefault(); const f = e.target;
          let st = f.elements.start.value || '06:00', en = f.elements.end.value || '14:00';
          if (en <= st) { toast('"Until" must be later than "From".'); return; }
          S.settings.motiv = { on: f.elements.on.checked, count: +f.elements.count.value, start: st, end: en, weekly: f.elements.weekly.checked };
          save(); syncNative(); toast(S.settings.motiv.on ? 'Saved. ' + S.settings.motiv.count + ' a day between ' + st + ' and ' + en + '.' : 'Morning motivation is off.');
        };
      };
      drawNative(); window.dlSettingsRedraw = drawNative;
    }
    const dbp = document.getElementById('dbpanel');
    if (dbp && BR && BR.dbInfo) {
      dbp.hidden = false;
      const drawDb = () => {
        let info = {}; try { info = JSON.parse(BR.dbInfo()); } catch (e) {}
        const snaps = info.snapshots || [];
        dbp.innerHTML = '<h2>Your data on this phone</h2><p>Everything (sessions, notes, statuses, retrospectives, your plan and settings) is saved in DataLeap’s own database on this phone after every change. Nothing is uploaded anywhere.</p>' +
          '<ul class="nativestat"><li><span class="chip st-done">Saved</span> ' + (info.updated ? 'Last saved ' + new Date(info.updated).toLocaleString() : 'Not saved yet') + (info.bytes ? ', ' + Math.max(1, Math.round(info.bytes / 1024)) + ' KB' : '') + '</li>' +
          '<li><span class="chip">' + snaps.length + '</span> daily snapshots kept (last 30 days)</li></ul>' +
          (snaps.length ? '<div class="row"><div class="field"><label for="snap">Restore a day</label><select id="snap">' + snaps.map((x) => '<option value="' + x.day + '">' + esc(niceDate(x.day)) + '</option>').join('') + '</select></div><div class="field" style="flex:0 0 auto"><button class="btn" id="snapgo" type="button">Restore</button></div></div>' : '') +
          '<p class="small muted">Uninstalling the app deletes this database. Before changing phones, use Progress → Export backup.</p>';
        const go = document.getElementById('snapgo');
        if (go) go.onclick = () => {
          const day = document.getElementById('snap').value;
          if (!confirm('Replace your current data with the snapshot from ' + niceDate(day) + '? Anything after that is lost.')) return;
          try { const raw = BR.dbSnapshot(day); const d = JSON.parse(raw); if (!d.sessions) throw 0; d.updatedAt = Date.now(); localStorage.setItem(KEY, JSON.stringify(d)); S = load(); save(); toast('Restored ' + niceDate(day)); setTimeout(() => location.reload(), 600); } catch (e) { toast('That snapshot could not be read.'); }
        };
      };
      drawDb();
    }
    const pb = document.getElementById('perm'); const ps = document.getElementById('permstate'); const tb = document.getElementById('testnote');
    const showPerm = () => {
      const has = 'Notification' in window;
      ps.textContent = !has ? 'This browser does not support notifications. Use the calendar option.' : Notification.permission === 'granted' ? 'Notifications are on.' : Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in the browser\'s site settings for this site.' : 'Notifications are off.';
      pb.hidden = !has || Notification.permission !== 'default'; tb.hidden = !has || Notification.permission !== 'granted';
    };
    if (pb) pb.onclick = () => Notification.requestPermission().then(showPerm);
    if (tb) tb.onclick = () => { if (!notify('DataLeap', 'Test reminder. ' + randomQuote('family'), 'index.html', 'dl-test')) toast('Could not show a notification in this browser.'); };
    if (pb && ps && tb) showPerm();
    const icsBtn = document.getElementById('ics');
    if (icsBtn) icsBtn.onclick = () => {
      if (BR) { BR.saveFile('dataleap-reminders.ics', 'text/calendar', icsFor(S.reminders)); return; }
      const blob = new Blob([icsFor(S.reminders)], { type: 'text/calendar' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dataleap-reminders.ics'; a.click();
      toast('Calendar file downloaded. Open it to add the reminders.');
    };
    // ladder
    const lf = document.getElementById('ladderform');
    document.getElementById('levels').innerHTML = '<table class="dtable"><thead><tr><th>Level</th><th class="num">System design</th><th class="num">DSA</th><th class="num">Minimum</th><th>What a session looks like</th><th class="num">Unlock after</th></tr></thead><tbody>' +
      D.levels.map((l) => '<tr' + (l.n === S.settings.level ? ' class="current"' : '') + '><td><b>' + l.n + '</b> ' + l.name + '</td><td class="num">' + l.sd + ' min</td><td class="num">' + l.dsa + ' min</td><td class="num">' + l.min + ' min</td><td class="small">' + esc(l.sdHow) + ' DSA: ' + esc(l.dsaHow) + '</td><td class="num">' + (l.need ? l.need + ' complete days' : '—') + '</td></tr>').join('') + '</tbody></table>';
    lf.elements.mode.value = S.settings.levelMode; lf.elements.level.value = S.settings.level;
    lf.elements.msd.value = S.settings.manual.sd; lf.elements.mdsa.value = S.settings.manual.dsa; lf.elements.mmin.value = S.settings.manual.min;
    lf.elements.weekendX.value = S.settings.weekendX; lf.elements.dayStart.value = S.settings.dayStart; lf.elements.restPerWeek.value = S.settings.restPerWeek; lf.elements.maxSession.value = cap();
    lf.onsubmit = (e) => {
      e.preventDefault();
      const nl = +lf.elements.level.value; if (nl !== S.settings.level) { S.settings.level = nl; S.settings.levelSince = today(); }
      S.settings.levelMode = lf.elements.mode.value;
      S.settings.manual = { sd: +lf.elements.msd.value || 30, dsa: +lf.elements.mdsa.value || 25, min: Math.max(1, +lf.elements.mmin.value || 10) };
      S.settings.weekendX = Math.max(1, +lf.elements.weekendX.value || 1.5);
      S.settings.dayStart = Math.min(23, Math.max(0, +lf.elements.dayStart.value || 0));
      S.settings.restPerWeek = Math.min(3, Math.max(0, +lf.elements.restPerWeek.value));
      S.settings.maxSession = Math.min(120, Math.max(10, +lf.elements.maxSession.value || 30));
      save(); toast('Saved');
    };
    document.getElementById('reset').onclick = () => { if (confirm('Delete all progress, notes and settings in this browser? Export a backup first if you need it.')) { localStorage.removeItem(KEY); localStorage.removeItem(TKEY); location.reload(); } };
  }

  // ---------- reminders (fire while any DataLeap tab is open) ----------
  function checkReminders() {
    if (BR) return; // the Android app schedules real alarms instead
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(); const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const t = today(); const info = dayInfo(t);
    S.reminders.forEach((r) => {
      if (!r.on || r.time !== hm || !r.days.includes(now.getDay())) return;
      const k = t + r.id; if (S.fired[k]) return;
      if (r.focus === 'family' || r.focus === 'sleep') { S.fired[k] = 1; save(); notify(r.focus === 'family' ? 'Family time' : 'Time to sleep', r.msg + '\n' + randomQuote('family'), 'plan.html', 'dl-life-' + r.id); return; }
      if (S.rest.includes(t) || info.status === 'ok') return;
      if (r.skip && ((r.focus === 'dsa' && info.dsaDone) || (r.focus === 'sd' && info.sdDone))) return;
      S.fired[k] = 1; save();
      const track = r.focus === 'either' ? (info.sdDone ? 'dsa' : 'sd') : r.focus;
      const sug = suggest(track);
      const body = r.msg + (sug ? '\nToday: ' + sug.item.title : '') + '\n' + randomQuote(missedYesterday() ? 'comeback' : (now.getHours() >= 20 ? 'family' : track));
      notify(r.last ? 'Last call' : 'DataLeap', body, 'index.html?start=' + track, 'dl-rem-' + r.id);
    });
  }

  // ---------- weeks ----------
  const weekStart = (d) => addDays(d, -((dow(d) + 6) % 7));
  function weekStats(ws) {
    const days = []; let sd = 0, dsa = 0, complete = 0, active = 0, best = null;
    for (let k = 0; k < 7; k++) {
      const d = addDays(ws, k); const i = dayInfo(d);
      days.push({ date: d, sd: i.sd, dsa: i.dsa, status: i.status, target: (() => { const tg = targets(d); return tg.sd + tg.dsa; })() });
      sd += i.sd; dsa += i.dsa; if (i.status === 'ok') complete++; if (i.sd + i.dsa > 0) active++;
      if (!best || i.sd + i.dsa > best.sd + best.dsa) best = { date: d, sd: i.sd, dsa: i.dsa };
    }
    return { ws, days, sd, dsa, min: sd + dsa, complete, active, best };
  }
  const shortDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  function longestStreak() {
    if (!S.sessions.length) return 0;
    let best = 0, run = 0;
    for (let d = firstDay(); d <= today(); d = addDays(d, 1)) {
      const s = dayInfo(d).status;
      if (s === 'ok') { run++; best = Math.max(best, run); } else if (s !== 'rest' && d !== today()) run = 0;
    }
    return best;
  }

  // ---------- charts (inline SVG, no libraries) ----------
  function dailyChart(w) {
    const W = 640, H = 220, padL = 34, padB = 28, padT = 18, cw = (W - padL - 10) / 7;
    const max = Math.max(30, ...w.days.map((d) => Math.max(d.sd + d.dsa, d.target)));
    const y = (v) => H - padB - (v / max) * (H - padB - padT);
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let g = '';
    [0, 0.5, 1].forEach((f) => { const v = Math.round(max * f); g += '<line x1="' + padL + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + v + '</text>'; });
    w.days.forEach((d, k) => {
      const x = padL + k * cw + cw * 0.2, bw = cw * 0.6; const isT = d.date === today(); const fut = d.date > today();
      const ysd = y(d.sd), ydsa = y(d.sd + d.dsa);
      g += '<rect x="' + x + '" y="' + ysd + '" width="' + bw + '" height="' + (H - padB - ysd) + '" rx="3" class="b-sd"><title>' + d.date + ': system design ' + d.sd + ' min</title></rect>';
      g += '<rect x="' + x + '" y="' + ydsa + '" width="' + bw + '" height="' + (ysd - ydsa) + '" rx="3" class="b-dsa"><title>' + d.date + ': DSA ' + d.dsa + ' min</title></rect>';
      if (!fut) g += '<line x1="' + (x - 3) + '" x2="' + (x + bw + 3) + '" y1="' + y(d.target) + '" y2="' + y(d.target) + '" class="tgt"/>';
      if (d.sd + d.dsa) g += '<text x="' + (x + bw / 2) + '" y="' + (ydsa - 5) + '" class="val" text-anchor="middle">' + (d.sd + d.dsa) + '</text>';
      g += '<text x="' + (x + bw / 2) + '" y="' + (H - 9) + '" class="ax' + (isT ? ' today' : '') + '" text-anchor="middle">' + names[k] + '</text>';
      if (d.status === 'ok') g += '<circle cx="' + (x + bw / 2) + '" cy="' + (H - padB + 6) + '" r="3" class="okdot"/>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Minutes per day for the week of ' + shortDate(w.ws) + '">' + g + '</svg>';
  }
  function weeklyChart(n) {
    const W = 440, H = 220, padL = 34, padB = 28, padT = 18;
    const ws = weekStart(today()); const weeks = [];
    for (let k = n - 1; k >= 0; k--) weeks.push(weekStats(addDays(ws, -7 * k)));
    const hrs = (m) => m / 60; const max = Math.max(2, ...weeks.map((w) => hrs(w.min)));
    const cw = (W - padL - 10) / n; const y = (v) => H - padB - (v / max) * (H - padB - padT);
    let g = '';
    [0, 0.5, 1].forEach((f) => { const v = +(max * f).toFixed(1); g += '<line x1="' + padL + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + v + 'h</text>'; });
    let pts = ''; const firstW = S.sessions.length ? weekStart(firstDay()) : today();
    weeks.forEach((w, k) => {
      const x = padL + k * cw + cw * 0.18, bw = cw * 0.64;
      const ysd = y(hrs(w.sd)), yall = y(hrs(w.min));
      g += '<rect x="' + x + '" y="' + ysd + '" width="' + bw + '" height="' + (H - padB - ysd) + '" rx="3" class="b-sd"><title>Week of ' + w.ws + ': system design ' + fmtH(w.sd) + '</title></rect>';
      g += '<rect x="' + x + '" y="' + yall + '" width="' + bw + '" height="' + (ysd - yall) + '" rx="3" class="b-dsa"><title>Week of ' + w.ws + ': DSA ' + fmtH(w.dsa) + '</title></rect>';
      if (k % 3 === (n - 1) % 3) g += '<text x="' + (x + bw / 2) + '" y="' + (H - 9) + '" class="ax' + (k === n - 1 ? ' today' : '') + '" text-anchor="middle">' + shortDate(w.ws) + '</text>';
      const prev = weeks.slice(Math.max(0, k - 3), k + 1); const avg = prev.reduce((a, x) => a + x.min, 0) / prev.length;
      if (w.ws >= firstW) pts += (pts ? ' ' : '') + (x + bw / 2) + ',' + y(hrs(avg));
    });
    g += '<polyline points="' + pts + '" class="avgline"/>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Hours per week, last ' + n + ' weeks">' + g + '</svg>';
  }

  // ---------- countdown and pace ----------
  function pace() {
    const p = S.profile; const t = today();
    const doneH = totalMinutes() / 60; const goal = +p.hoursGoal || 250;
    const daysLeft = p.targetDate ? Math.max(0, daysBetween(t, p.targetDate)) : null;
    let last28 = 0; S.sessions.forEach((x) => { if (x.date > addDays(t, -28) && x.date <= t) last28 += x.minutes; });
    const started = S.sessions.length ? Math.min(28, daysBetween(firstDay(), t) + 1) : 0;
    const avgWeekH = started ? (last28 / 60) / (started / 7) : 0;
    const weeksLeft = daysLeft === null ? null : Math.max(1, daysLeft / 7);
    const needWeekH = weeksLeft === null ? null : Math.max(0, (goal - doneH) / weeksLeft);
    const finishDays = avgWeekH > 0 ? Math.ceil(((goal - doneH) / avgWeekH) * 7) : null;
    return { doneH, goal, daysLeft, avgWeekH, needWeekH, finishDays, applyBy: p.targetDate ? addDays(p.targetDate, -42) : null };
  }
  function countdownParts() {
    const p = S.profile; if (!p.targetDate) return null;
    const [y, m, d] = p.targetDate.split('-').map(Number);
    let ms = new Date(y, m - 1, d, 23, 59, 59) - new Date(); if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  }
  function updateCountdown() {
    const el = document.getElementById('cd-live'); if (!el) return;
    const c = countdownParts(); if (!c) return;
    el.innerHTML = '<span><b>' + c.d + '</b>days</span><span><b>' + pad(c.h) + '</b>hrs</span><span><b>' + pad(c.m) + '</b>min</span><span><b>' + pad(c.s) + '</b>sec</span>';
  }

  // ---------- interview readiness ----------
  function readiness() {
    const sdItems = D.items.filter((i) => i.track === 'sd' && (!i.lib || i.tier === 'must'));
    const sdDone = sdItems.filter((i) => ['done', 'mastered'].includes(st(i.id).status)).length;
    const scores = D.items.flatMap((i) => (st(i.id).scores || [])).sort((a, b) => b.at - a.at).slice(0, 5);
    const rub = scores.length ? scores.reduce((a, x) => a + x.total, 0) / scores.length / 14 : 0;
    const p1 = D.items.filter((i) => i.track === 'dsa' && (D.dsaTopics.find((t) => t.code === i.topic) || {}).priority === 1);
    const dsaOwn = p1.filter((i) => ['solved', 'mastered'].includes(st(i.id).status)).length;
    let complete = 0; for (let k = 0; k < 28; k++) if (dayInfo(addDays(today(), -k)).status === 'ok') complete++;
    const stories = Math.min(1, ((S.stories || []).filter((x) => storyStrength(x) >= 80).length) / 6);
    const mocks = Math.min(1, ((S.mocks || []).filter((m) => m.score >= 3).length * 1 + (S.mocks || []).filter((m) => m.score < 3).length * 0.5) / 8);
    const parts = [
      { k: 'sd', label: 'System design coverage', v: sdDone / sdItems.length, w: 25, tip: 'Finish more system design topics and course lessons. One a day moves this fastest.' },
      { k: 'rub', label: 'Design answer quality', v: rub, w: 20, tip: 'Do a full design case in 45 minutes and score it with the staff rubric. Aim for 10 out of 14.' },
      { k: 'dsa', label: 'DSA, priority topics solved alone', v: dsaOwn / p1.length, w: 20, tip: 'Solve priority-1 DSA questions without hints, in 25 minutes, out loud.' },
      { k: 'con', label: 'Consistency, last 4 weeks', v: complete / 28, w: 15, tip: 'Complete more days. Even the minimum counts; consistency is what interviews feel.' },
      { k: 'story', label: 'Story bank, interview-ready', v: stories, w: 10, tip: 'Write up one system from your 10 years in the Career kit: real numbers, your decisions, what you would change.' },
      { k: 'mock', label: 'Mock interviews', v: mocks, w: 10, tip: 'Book a mock interview with an ex-colleague at a product company, then log it in the Career kit.' }
    ];
    const score = Math.round(parts.reduce((a, x) => a + x.v * x.w, 0));
    const weakest = parts.slice().sort((a, b) => a.v - b.v)[0];
    const label = score < 30 ? 'Building foundations' : score < 55 ? 'Getting there' : score < 70 ? 'Almost interview-ready' : 'Ready to start applying';
    return { score, parts, weakest, label };
  }

  // ---------- weekly retrospective ----------
  function retroFor(ws) { return (S.retros || []).find((r) => r.week === ws); }
  function retroDue() {
    if (!S.sessions.length) return null;
    const t = today(); const d = dow(t); const thisW = weekStart(t); const lastW = addDays(thisW, -7);
    if (d === 0 && !retroFor(thisW)) return thisW;
    if ((d === 1 || d === 2) && !retroFor(lastW) && firstDay() <= addDays(lastW, 6)) return lastW;
    return null;
  }
  function latestPlan() {
    const r = (S.retros || []).slice().sort((a, b) => b.at - a.at)[0];
    if (!r || !r.change) return null;
    return daysBetween(r.week, today()) <= 13 ? r.change : null;
  }
  function openRetro(ws) {
    ws = ws || retroDue() || weekStart(today());
    const w = weekStats(ws); const pw = weekStats(addDays(ws, -7)); const old = retroFor(ws) || {};
    const diff = w.min - pw.min;
    const intro = w.complete >= 5 ? 'A strong week. Let’s lock in what worked.' : w.min > 0 ? 'Every week teaches something. Three minutes, honestly.' : 'A week with no practice happens. No guilt: let’s find what got in the way and fix one thing.';
    let d = document.getElementById('retrodlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'retrodlg'; document.body.appendChild(d); }
    const moods = ['😞', '😕', '😐', '🙂', '😄'];
    d.innerHTML = '<form class="dlg" id="retroform"><div class="dlg-head"><div><p class="muted small" style="margin:0">Weekly retrospective</p><h2>Week of ' + shortDate(ws) + '</h2></div><button class="btn quiet" type="button" data-close aria-label="Close">Close</button></div>' +
      '<div class="retro-stats"><span><b>' + fmtH(w.min) + '</b>practice' + (pw.min || w.min ? ' <em class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '+' : '−') + fmtH(Math.abs(diff)) + '</em>' : '') + '</span><span><b>' + w.complete + '/7</b>complete days</span><span><b>' + fmtH(w.sd) + '</b>system design</span><span><b>' + (w.best && w.best.sd + w.best.dsa ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow(w.best.date)] : '—') + '</b>best day</span></div>' +
      '<p class="coach-inline"><span class="coach-av sm" aria-hidden="true">' + MARK + '</span>' + esc(intro) + '</p>' +
      '<fieldset class="field moods"><legend>How did the week feel?</legend>' + moods.map((m, k) => '<label><input type="radio" name="mood" value="' + (k + 1) + '"' + (+old.mood === k + 1 ? ' checked' : '') + '><span>' + m + '</span></label>').join('') + '</fieldset>' +
      '<div class="field"><label for="rt-well">What went well?</label><textarea id="rt-well" name="well" rows="3" placeholder="e.g. Morning sessions before standup worked; finished the CDC case">' + esc(old.well || '') + '</textarea></div>' +
      '<div class="field"><label for="rt-block">What got in the way?</label><textarea id="rt-block" name="blockers" rows="3" placeholder="e.g. Late client calls ate my evenings; weekend family function">' + esc(old.blockers || '') + '</textarea></div>' +
      '<div class="field"><label for="rt-change">One change for next week</label><textarea id="rt-change" name="change" rows="2" placeholder="e.g. 20 minutes of system design at 7 am, before office">' + esc(old.change || '') + '</textarea></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Save retrospective</button></div></form>';
    d.querySelector('#retroform').onsubmit = (e) => {
      e.preventDefault(); const f = e.target;
      const r = { week: ws, mood: +(f.querySelector('input[name=mood]:checked') || {}).value || 0, well: f.elements.well.value.trim(), blockers: f.elements.blockers.value.trim(), change: f.elements.change.value.trim(), at: Date.now(), min: w.min, complete: w.complete };
      S.retros = (S.retros || []).filter((x) => x.week !== ws).concat([r]); save(); d.close();
      showCoachCard((r.change ? 'Plan for next week: “' + r.change + '”. I’ll keep it in front of you every day. ' : 'Saved. ') + 'Tap to send your weekly check-in' + (S.profile.partner ? ' to ' + S.profile.partner : '') + '.', () => shareText(weeklyReportText()));
      checkProgress(); refresh();
    };
    if (!d.open) d.showModal();
  }
  function retroList() {
    const rs = (S.retros || []).slice().sort((a, b) => b.at - a.at);
    if (!rs.length) return '<p class="muted">No retrospectives yet. Every Sunday (or Monday) DataLeap asks three questions about your week. It takes three minutes and makes next week better.</p>';
    const moods = ['', '😞', '😕', '😐', '🙂', '😄'];
    return rs.slice(0, 12).map((r) => '<div class="retro-item"><div class="retro-head"><b>Week of ' + shortDate(r.week) + '</b><span>' + (moods[r.mood] || '') + ' ' + fmtH(r.min || 0) + ', ' + (r.complete || 0) + '/7 days</span><button class="linkish small" data-retro="' + r.week + '">Edit</button></div>' +
      (r.well ? '<p><span class="tag ok">Went well</span>' + esc(r.well) + '</p>' : '') + (r.blockers ? '<p><span class="tag bad">Got in the way</span>' + esc(r.blockers) + '</p>' : '') + (r.change ? '<p><span class="tag plan">Change</span>' + esc(r.change) + '</p>' : '') + '</div>').join('');
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-retro]'); if (b) { e.preventDefault(); openRetro(b.dataset.retro || undefined); } });

  // ---------- milestones: celebrate properly, then point at the next one ----------
  const ACH = [
    { id: 'first', g: 'Start', icon: '🌱', t: 'First step', d: 'Logged your first session', ok: (c) => c.sessions >= 1, msg: 'After {years} years of delivering for others, you chose to invest in yourself. That takes more courage than any interview.' },
    { id: 'comeback', g: 'Start', icon: '🔁', t: 'The comeback', d: 'Completed a day right after missing one', ok: (c) => c.comeback, msg: 'You missed a day and came straight back. That single habit gets more offers than talent does.' },
    { id: 'h5', g: 'Hours', icon: '⏱️', t: '5 hours', d: '5 hours of focused prep', ok: (c) => c.hours >= 5, msg: 'Five hours. Most people who say “I will prepare” never reach this.' },
    { id: 'h10', g: 'Hours', icon: '⏱️', t: '10 hours', d: '10 hours of focused prep', ok: (c) => c.hours >= 10, msg: 'Ten hours. The habit is real now; protect it.' },
    { id: 'h25', g: 'Hours', icon: '⏱️', t: '25 hours', d: '25 hours of focused prep', ok: (c) => c.hours >= 25, msg: '25 hours: a full extra work week of preparation, done around a full-time job and a family.' },
    { id: 'h50', g: 'Hours', icon: '🔥', t: '50 hours', d: '50 hours of focused prep', ok: (c) => c.hours >= 50, msg: 'Fifty hours. You now prepare like the people who sit across the interview table.' },
    { id: 'h100', g: 'Hours', icon: '🔥', t: '100 hours', d: '100 hours of focused prep', ok: (c) => c.hours >= 100, msg: 'A hundred hours. This is what serious looks like. {her} has a father who doesn’t quit.' },
    { id: 'h150', g: 'Hours', icon: '🔥', t: '150 hours', d: '150 hours of focused prep', ok: (c) => c.hours >= 150, msg: '150 hours. The gap between service and product is closing, session by session.' },
    { id: 'h200', g: 'Hours', icon: '🏔️', t: '200 hours', d: '200 hours of focused prep', ok: (c) => c.hours >= 200, msg: '200 hours. Few engineers in India prepare this deliberately for anything.' },
    { id: 'hgoal', g: 'Hours', icon: '🏁', t: 'Plan complete', d: 'Reached your prep-hours goal', ok: (c) => c.hours >= c.goal, msg: 'You did the whole plan. Now walk into those interviews like the staff engineer you trained to be.' },
    { id: 's3', g: 'Streaks', icon: '⚡', t: '3-day streak', d: '3 complete days in a row', ok: (c) => c.longest >= 3, msg: 'Three days in a row. The habit has started.' },
    { id: 's7', g: 'Streaks', icon: '⚡', t: '7-day streak', d: 'A full week without missing', ok: (c) => c.longest >= 7, msg: 'One full week. Most people never get here.' },
    { id: 's14', g: 'Streaks', icon: '⚡', t: '14-day streak', d: 'Two weeks without missing', ok: (c) => c.longest >= 14, msg: 'Two weeks. This is becoming who you are.' },
    { id: 's30', g: 'Streaks', icon: '💎', t: '30-day streak', d: 'A month without missing', ok: (c) => c.longest >= 30, msg: 'Thirty days. A month of proof that you keep your word to yourself.' },
    { id: 's50', g: 'Streaks', icon: '💎', t: '50-day streak', d: '50 days without missing', ok: (c) => c.longest >= 50, msg: 'Fifty days. Interviewers can feel this kind of preparation.' },
    { id: 's100', g: 'Streaks', icon: '👑', t: '100-day streak', d: '100 days without missing', ok: (c) => c.longest >= 100, msg: 'One hundred days. Whatever happens next, you built this.' },
    { id: 'wk7', g: 'Weeks', icon: '📅', t: 'Serious week', d: '7+ hours in one week', ok: (c) => c.bestWeek >= 420, msg: 'Seven hours in a week, on top of a full job. That is product-company effort.' },
    { id: 'wk5', g: 'Weeks', icon: '📅', t: 'Five out of seven', d: '5 complete days in one week', ok: (c) => c.bestComplete >= 5, msg: 'Five complete days in one week. That is the rhythm that gets you to the offer.' },
    { id: 'sd10', g: 'Skills', icon: '🧠', t: 'Systems thinker', d: '10 system design topics done', ok: (c) => c.sdDone >= 10, msg: 'Ten system design topics. You are learning to say out loud what you have done for years.' },
    { id: 'sd30', g: 'Skills', icon: '🧠', t: 'Design depth', d: '30 system design topics done', ok: (c) => c.sdDone >= 30, msg: 'Thirty topics. Your answers now have depth that most candidates only fake.' },
    { id: 'dsa10', g: 'Skills', icon: '🧩', t: 'Problem solver', d: '10 DSA questions solved on your own', ok: (c) => c.dsaOwn >= 10, msg: 'Ten solved on your own, no hints. The gate is opening.' },
    { id: 'dsa30', g: 'Skills', icon: '🧩', t: 'Pattern master', d: '30 DSA questions solved on your own', ok: (c) => c.dsaOwn >= 30, msg: 'Thirty solved alone. DSA is no longer the thing that can stop you.' },
    { id: 'case1', g: 'Skills', icon: '🏗️', t: 'First full design', d: 'Scored your first design case', ok: (c) => c.scored >= 1, msg: 'Your first full design, scored honestly. Staff engineers are built exactly like this.' },
    { id: 'case10', g: 'Skills', icon: '🏗️', t: 'Staff-level answer', d: 'A design case scored 10+ out of 14', ok: (c) => c.best >= 10, msg: '10 out of 14. That is a staff-level answer. Remember this feeling in the real room.' },
    { id: 'case5', g: 'Skills', icon: '🏆', t: 'Consistently staff', d: '5 design cases scored 10+', ok: (c) => c.staffCases >= 5, msg: 'Five staff-level designs. You are ready to be tested for real.' },
    { id: 'story1', g: 'Career', icon: '📖', t: 'First story', d: 'An interview-ready project story', ok: (c) => c.stories >= 1, msg: 'Your first story, told as YOUR decisions with real numbers. This is how {years} years of service work becomes staff-level evidence.' },
    { id: 'story6', g: 'Career', icon: '📚', t: 'Story bank complete', d: '6 interview-ready stories', ok: (c) => c.stories >= 6, msg: 'Six stories. No deep-dive round can surprise you now.' },
    { id: 'mock1', g: 'Career', icon: '🎙️', t: 'First mock', d: 'Did your first mock interview', ok: (c) => c.mocks >= 1, msg: 'The first mock is the hardest one to book. You did it.' },
    { id: 'mock5', g: 'Career', icon: '🎙️', t: 'Interview-hardened', d: '5 mock interviews', ok: (c) => c.mocks >= 5, msg: 'Five mocks. The real loop will feel familiar now.' },
    { id: 'mockhire', g: 'Career', icon: '✅', t: 'Hire signal', d: 'A “strong hire” in a mock', ok: (c) => c.strongHire, msg: 'Strong hire. Remember exactly how you did that; it is your interview style now.' },
    { id: 'lvl2', g: 'Levels', icon: '🪜', t: 'Level 2', d: 'Unlocked “build the habit”', ok: (c) => c.level >= 2, quiet: true },
    { id: 'lvl3', g: 'Levels', icon: '🪜', t: 'Level 3', d: 'Unlocked “go deeper”', ok: (c) => c.level >= 3, quiet: true },
    { id: 'lvl4', g: 'Levels', icon: '🪜', t: 'Level 4', d: 'Unlocked “interview pace”', ok: (c) => c.level >= 4, quiet: true },
    { id: 'retro1', g: 'Reflection', icon: '🪞', t: 'First retrospective', d: 'Reviewed your first week', ok: (c) => c.retros >= 1, msg: 'You looked back honestly. Good engineers run retros on systems; great ones run them on themselves.' },
    { id: 'retro4', g: 'Reflection', icon: '🪞', t: 'A month of reflection', d: '4 weekly retrospectives', ok: (c) => c.retros >= 4, msg: 'Four retros. You are not just working hard, you are working smarter every week.' }
  ];
  function achContext() {
    let comeback = false, prevMiss = false, bestWeek = 0, bestComplete = 0;
    if (S.sessions.length) {
      for (let d = firstDay(); d <= today(); d = addDays(d, 1)) { const s = dayInfo(d).status; if (s === 'ok' && prevMiss) comeback = true; prevMiss = s === 'miss' && d !== today(); }
      for (let w = weekStart(firstDay()); w <= today(); w = addDays(w, 7)) { const x = weekStats(w); bestWeek = Math.max(bestWeek, x.min); bestComplete = Math.max(bestComplete, x.complete); }
    }
    const scores = D.items.flatMap((i) => st(i.id).scores || []);
    const staffCases = D.items.filter((i) => (st(i.id).scores || []).some((x) => x.total >= 10)).length;
    return {
      sessions: S.sessions.length, hours: totalMinutes() / 60, goal: +S.profile.hoursGoal || 250, longest: longestStreak(), comeback, bestWeek, bestComplete,
      sdDone: D.items.filter((i) => i.track === 'sd' && ['done', 'mastered'].includes(st(i.id).status)).length,
      dsaOwn: D.items.filter((i) => i.track === 'dsa' && ['solved', 'mastered'].includes(st(i.id).status)).length,
      scored: scores.length, best: scores.reduce((a, x) => Math.max(a, x.total), 0), staffCases, level: S.settings.level, retros: (S.retros || []).length,
      stories: (S.stories || []).filter((x) => storyStrength(x) >= 80).length, mocks: (S.mocks || []).length, strongHire: (S.mocks || []).some((m) => m.score === 4)
    };
  }
  function nextMilestone(c) {
    c = c || achContext();
    const hourSteps = [5, 10, 25, 50, 100, 150, 200, c.goal].filter((h) => h > c.hours).sort((a, b) => a - b);
    const sk = streak(); const streakSteps = [3, 7, 14, 30, 50, 100].filter((s) => s > sk);
    const opts = [];
    if (hourSteps.length) opts.push({ txt: hourSteps[0] + ' hours', left: (hourSteps[0] - c.hours), unit: 'h', frac: c.hours / hourSteps[0] });
    if (streakSteps.length) opts.push({ txt: streakSteps[0] + '-day streak', left: streakSteps[0] - sk, unit: ' day', frac: sk / streakSteps[0] });
    opts.sort((a, b) => b.frac - a.frac);
    const o = opts[0]; if (!o) return null;
    return o.txt + ': ' + (o.unit === 'h' ? (Math.round(o.left * 10) / 10) + ' h to go' : o.left + (o.left > 1 ? ' days' : ' day') + ' to go');
  }
  function persona(t) { return personal(t.replace('{years}', String(S.profile.years || 10)).replace('{her}', her().charAt(0).toUpperCase() + her().slice(1))); }
  let awardQueue = [];
  function checkAchievements() {
    S.ach = S.ach || {};
    const c = achContext(); const fresh = [];
    ACH.forEach((a) => { if (!S.ach[a.id] && a.ok(c)) { S.ach[a.id] = Date.now(); if (S.achInit && !a.quiet) fresh.push(a); } });
    const first = !S.achInit; S.achInit = true;
    if (fresh.length || first) save();
    if (fresh.length) {
      // Several at once (e.g. after a busy week): celebrate the biggest, list the rest on the same card.
      const lead = fresh[fresh.length - 1];
      const item = fresh.length > 1 ? Object.assign({}, lead, { also: fresh.slice(0, -1).map((x) => x.icon + ' ' + x.t) }) : lead;
      awardQueue.push(item); if (awardQueue.length === 1) setTimeout(showAward, 700);
    }
  }
  function showAward() {
    const a = awardQueue.shift(); if (!a) return;
    let d = document.getElementById('awarddlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'awarddlg'; d.className = 'award'; document.body.appendChild(d); d.addEventListener('close', () => { if (awardQueue.length) setTimeout(showAward, 400); }); }
    const nx = nextMilestone();
    d.innerHTML = '<div class="award-in"><p class="award-kicker">Milestone unlocked</p><div class="award-badge" aria-hidden="true">' + a.icon + '</div><h2>' + esc(a.t) + '</h2><p class="award-d">' + esc(a.d) + '</p>' +
      '<p class="award-msg"><span class="coach-av sm" aria-hidden="true">' + MARK + '</span><span>' + esc(persona(a.msg || '')) + '</span></p>' +
      (a.also ? '<p class="award-also">Also unlocked: ' + a.also.map(esc).join(' · ') + '</p>' : '') +
      (nx ? '<p class="award-next">Next: ' + esc(nx) + '</p>' : '') + '<button class="btn haldi" type="button" data-close>Keep going</button></div>';
    d.showModal(); releaseBalloons(7, ['family', 'switch'], false);
    notify('Milestone: ' + a.t, persona(a.msg || a.d), 'progress.html', 'dl-ach-' + a.id);
  }
  function achGallery() {
    const S2 = S.ach || {}; const groups = [...new Set(ACH.map((a) => a.g))];
    const earned = ACH.filter((a) => S2[a.id]).length;
    return '<p class="muted" style="margin:0 0 14px">' + earned + ' of ' + ACH.length + ' unlocked' + (nextMilestone() ? '. Next: ' + esc(nextMilestone()) : '') + '</p>' +
      groups.map((g) => '<h3 class="achg">' + g + '</h3><div class="achgrid">' + ACH.filter((a) => a.g === g).map((a) => '<div class="ach' + (S2[a.id] ? ' on' : '') + '" title="' + esc(a.d) + '"><span class="ai" aria-hidden="true">' + (S2[a.id] ? a.icon : '🔒') + '</span><b>' + esc(a.t) + '</b><small>' + (S2[a.id] ? new Date(S2[a.id]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : esc(a.d)) + '</small></div>').join('') + '</div>').join('');
  }

  // ---------- progress page: report, countdown, readiness, retro, milestones ----------
  let reportWeek = null;
  function renderReport() {
    const t = today();
    if (!reportWeek) { reportWeek = weekStart(t); if (weekStats(reportWeek).min === 0 && dow(t) >= 1 && dow(t) <= 2 && S.sessions.length) reportWeek = addDays(reportWeek, -7); }
    const w = weekStats(reportWeek); const pw = weekStats(addDays(reportWeek, -7));
    // For the current week, compare with last week up to the same day, so a fresh Monday isn't "down 100%".
    const isNow = reportWeek === weekStart(t); const upto = isNow ? (dow(t) + 6) % 7 : 6;
    const pwSame = pw.days.slice(0, upto + 1).reduce((a, d) => a + d.sd + d.dsa, 0);
    const diff = w.min - pwSame; const pct = pwSame && (!isNow || w.min) ? Math.round((diff / pwSame) * 100) : null;
    const avgActive = w.active ? Math.round(w.min / w.active) : 0;
    document.getElementById('report').innerHTML =
      '<div class="rep-head"><button class="btn small" data-wk="-1" type="button" aria-label="Previous week">‹</button><h3>Week of ' + shortDate(reportWeek) + (reportWeek === weekStart(t) ? ' (this week)' : '') + '</h3><button class="btn small" data-wk="1" type="button" aria-label="Next week"' + (reportWeek >= weekStart(t) ? ' disabled' : '') + '>›</button></div>' +
      '<div class="rep-stats"><div><b>' + fmtH(w.min) + '</b><span>total' + (pct !== null ? (isNow ? ' vs same point last week' : '') + ' <em class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%</em>' : '') + '</span></div><div><b>' + w.complete + '/7</b><span>complete days</span></div><div><b>' + fmtH(avgActive) + '</b><span>per active day</span></div><div><b>' + (w.min ? Math.round((w.sd / w.min) * 100) : 0) + '%</b><span>system design</span></div></div>' +
      dailyChart(w) + '<div class="legend"><span><i class="cell" style="background:var(--haldi)"></i>System design</span><span><i class="cell" style="background:var(--violet)"></i>DSA</span><span><i class="lg-tgt"></i>Daily target</span><span><i class="cell ok" style="border-radius:50%"></i>Day complete</span></div>';
    document.querySelectorAll('[data-wk]').forEach((b) => { b.onclick = () => { reportWeek = addDays(reportWeek, 7 * +b.dataset.wk); renderReport(); }; });
  }
  function renderGrowth() {
    const pc = pace(); const r = readiness(); const p = S.profile;
    const cd = document.getElementById('countdown');
    if (cd) {
      if (!p.targetDate) cd.innerHTML = '<p>Set your offer date on <a href="why.html">My why</a> to start the countdown.</p>';
      else {
        const onTrack = pc.needWeekH === null || pc.avgWeekH >= pc.needWeekH;
        const finish = pc.finishDays !== null ? addDays(today(), pc.finishDays) : null;
        cd.innerHTML = '<p class="cd-label">Countdown to your ' + esc(p.role) + ' offer, ' + esc(niceDate(p.targetDate)) + '</p><div class="cd-live" id="cd-live"></div>' +
          '<div class="pace ' + (onTrack ? 'good' : 'behind') + '"><b>' + (onTrack ? 'On track.' : 'Behind pace.') + '</b> You need <b>' + (Math.round(pc.needWeekH * 10) / 10) + ' h a week</b> to reach ' + pc.goal + ' hours; your last 4 weeks average <b>' + (Math.round(pc.avgWeekH * 10) / 10) + ' h</b>.' +
          (onTrack ? (finish ? ' At this pace you finish the plan around ' + esc(shortDate(finish)) + '.' : '') : ' Add ' + (Math.round((pc.needWeekH - pc.avgWeekH) * 60 / 7)) + ' minutes a day to catch up.') + '</div>' +
          '<p class="cd-note">Start applying by <b>' + esc(shortDate(pc.applyBy)) + '</b>: product-company loops in India usually take 4 to 6 weeks from first call to offer, and your notice period starts only after you sign.</p>';
        updateCountdown();
      }
    }
    const rd = document.getElementById('readiness');
    if (rd) rd.innerHTML = '<div class="ready-top"><div class="ring" style="--p:' + r.score + '"><b>' + r.score + '</b><span>%</span></div><div><p class="ready-label">' + r.label + '</p><p class="muted" style="margin:0">Interview readiness, from your real progress. Aim for 70% before you apply.</p></div></div>' +
      r.parts.map((x) => '<div class="rpart"><div class="rp-top"><span>' + x.label + '</span><b>' + Math.round(x.v * 100) + '%</b></div><div class="bar"><i style="width:' + Math.round(x.v * 100) + '%"></i></div></div>').join('') +
      '<p class="next-step"><b>Next best step:</b> ' + esc(r.weakest.tip) + '</p>';
    const wc = document.getElementById('weekly'); if (wc) wc.innerHTML = weeklyChart(12) + '<div class="legend"><span><i class="cell" style="background:var(--haldi)"></i>System design</span><span><i class="cell" style="background:var(--violet)"></i>DSA</span><span><i class="lg-avg"></i>4-week average</span></div>';
    const rt = document.getElementById('retros'); if (rt) rt.innerHTML = (retroDue() ? '<div class="banner"><b>Your weekly retrospective is ready.</b> Three questions, three minutes. <button class="btn small primary" data-retro="" type="button">Start</button></div>' : '<p style="margin:0 0 12px"><button class="btn small" data-retro="" type="button">Write a retrospective for this week</button></p>') + retroList();
    const ag = document.getElementById('achievements'); if (ag) ag.innerHTML = achGallery();
    if (document.getElementById('report')) renderReport();
  }

  // ---------- career mentor: the day plan ----------
  const toMin = (hhmm, def) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? (+m[1]) * 60 + (+m[2]) : def; };
  const toHM = (m) => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const ampm = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + (mm ? ':' + pad(mm) : '') + (h < 12 ? ' am' : ' pm'); };
  function life() {
    return Object.assign({ officeStart: '14:30', officeEnd: '23:30', commute: 30, wake: '07:30', sleep: '00:30', weekendOff: true }, S.profile.life || {});
  }
  /** Weekday and weekend blocks, built from office hours, commute, wake and sleep times. Minutes from midnight. */
  function buildPlan() {
    const l = life(); const n = her();
    const W = toMin(l.wake, 450), O = toMin(l.officeStart, 870), E = toMin(l.officeEnd, 1410);
    let SL = toMin(l.sleep, 30); if (SL < W) SL += 1440;
    const leave = O - (+l.commute || 0), ready = leave - 30;
    const lunch = ready - 75;
    const b = [];
    const add = (s, e, kind, title, why) => { if (e > s) b.push({ s, e, kind, title, why }); };
    let t = W;
    add(t, t + 75, 'family', 'Family morning', n.charAt(0).toUpperCase() + n.slice(1) + ' is awake and fresh, and so are you. On office days this is your time with her. Phone stays away.'); t += 75;
    const sdLen = Math.max(30, Math.min(75, lunch - t - 150));
    add(t, t + sdLen, 'sd', 'Deep work: system design', 'Your sharpest hour goes to the round that decides staff offers. Today’s item is ready on the Today screen.'); t += sdLen;
    add(t, t + 10, 'break', 'Break', 'Water, stretch, check on the family.'); t += 10;
    add(t, t + 30, 'dsa', 'DSA: one question', 'One data-engineering question, 25 minutes, out loud.'); t += 30;
    add(t, t + 30, 'health', 'Walk or exercise', 'A 9-hour shift needs a body that can carry it. Take her along in the stroller if you can.'); t += 30;
    add(t, lunch, 'family', 'Time with ' + n, 'Play, stories, the park. This is the time she will remember.');
    add(lunch, ready - 15, 'family', 'Family lunch', 'Eat together. Then she naps and you get ready.');
    add(ready - 15, ready, 'rev', 'Revision: pinned notes', '15 minutes reading your key notes. Easy, and it compounds.');
    add(ready, leave, 'life', 'Get ready', '');
    if (leave < O) add(leave, O, 'life', 'Commute', 'Audio only: a system design video or podcast if you like. Never on a bike.');
    add(O, E, 'office', 'Office', 'Do your job well. It pays for everything else, and your next manager will ask about it.');
    add(E, E + 20, 'wind', 'Wind down', 'Only if today is incomplete: the 10-minute version. Then log, close the laptop.');
    add(E + 20, SL, 'life', 'Dinner, unwind', 'No studying after a 9-hour shift. Tired study builds nothing.');
    add(SL, W + 1440, 'sleep', 'Sleep', 'Seven hours. Tomorrow’s deep work depends on tonight’s sleep.');
    const sat = [];
    const sw = W + 30; const addS = (s, e, kind, title, why) => sat.push({ s, e, kind, title, why });
    addS(sw, sw + 90, 'family', 'Slow family morning', 'No alarms beyond this one. Breakfast together.');
    addS(sw + 90, sw + 180, 'sd', 'Full design case or mock interview', '90 minutes, timed, scored with the staff rubric. This is where offers are won.');
    addS(sw + 180, sw + 195, 'break', 'Break', '');
    addS(sw + 195, sw + 240, 'dsa', 'Two DSA questions', 'Interview conditions: 25 minutes each.');
    addS(sw + 240, sw + 600, 'family', 'Family afternoon', 'Outing, park, family visits. Fully present: the work is done.');
    const sun = [
      { s: sw, e: sw + 600, kind: 'family', title: 'Family day', why: 'Rest is part of the plan. Use your rest day if you want the whole day.' },
      { s: 1080, e: 1110, kind: 'rev', title: 'Weekly retrospective + revision', why: 'Three questions about the week, then 20 minutes of pinned notes.' }
    ];
    return { weekday: b, sat, sun, l, budget: { weekday: sdLen + 30 + 15, sat: 135, sun: 20 } };
  }
  /** Reminders that follow the plan. Replaces the reminder list (max 12). */
  function planReminders(p) {
    const wk = [1, 2, 3, 4, 5]; const find = (k, list) => (list || p.weekday).find((x) => x.kind === k);
    const fam = p.weekday[0], sd = find('sd'), dsa = find('dsa'), rev = find('rev'), wind = find('wind'), sleep = find('sleep');
    const daughterBlock = p.weekday.find((x) => x.kind === 'family' && x.title.indexOf('Time with') === 0);
    const satSd = find('sd', p.sat), satDsa = find('dsa', p.sat), sunRev = find('rev', p.sun);
    const r = (id, m, days, focus, msg, extra) => Object.assign({ id, time: toHM(m), days, focus, msg, skip: true, last: false, on: true }, extra || {});
    return [
      r('p-fam', fam.s + 5, [0, 1, 2, 3, 4, 5, 6], 'family', 'Family morning: phone down. Be with {name}.'),
      r('p-sd', sd.s - 5, wk, 'sd', 'Deep work in 5 minutes: system design. Your sharpest hour.'),
      r('p-dsa', dsa.s, wk, 'dsa', 'DSA: one question, 25 minutes, out loud.'),
      r('p-kid', daughterBlock ? daughterBlock.s : dsa.e + 30, wk, 'family', 'Laptop closed. Time with {name}.'),
      r('p-rev', rev.s, wk, 'either', '15-minute revision before you get ready for office.'),
      r('p-last', wind.s + 10, wk, 'either', 'Office done. Only if today is incomplete: the 10-minute version, then rest.', { last: true }),
      r('p-sleep', sleep.s - 15, [0, 1, 2, 3, 4, 5, 6], 'sleep', 'Wind down in 15 minutes. Sleep by ' + ampm(sleep.s) + '.'),
      r('p-sat', satSd.s - 5, [6], 'sd', 'Saturday deep work: one full design case or a mock interview.'),
      r('p-satdsa', satDsa.s, [6], 'dsa', 'Two DSA questions under interview conditions.'),
      r('p-sun', sunRev.s, [0], 'either', 'Sunday: weekly retrospective and 20 minutes of revision. Then back to family.')
    ].map((x) => Object.assign(x, { msg: x.msg.replace('{name}', her()) }));
  }
  function applyPlan(silent) {
    const p = buildPlan();
    S.reminders = planReminders(p);
    S.settings.motiv = Object.assign({}, S.settings.motiv, { on: true, count: 3, start: toHM(toMin(p.l.wake, 450) + 20), end: toHM(toMin(p.l.officeStart, 870) - 30) });
    S.settings.restPerWeek = Math.max(1, S.settings.restPerWeek);
    S.planApplied = Date.now(); save(); syncNative();
    if (!silent) showCoachCard('Done. Your reminders now follow your day: family first in the morning, deep work at ' + ampm(p.weekday.find((x) => x.kind === 'sd').s) + ', nothing heavy after office, sleep by ' + ampm(p.weekday.find((x) => x.kind === 'sleep').s) + '.');
  }
  function blocksFor(date) { const p = buildPlan(); const d = dow(date); return d === 6 ? p.sat : d === 0 ? p.sun : p.weekday; }
  function nowBlock() {
    const now = new Date(); let m = now.getHours() * 60 + now.getMinutes();
    const bl = blocksFor(ymd(now)); let cur = null, next = null;
    for (const b of bl) { const mm = m < b.s && b.e > 1440 && m < 360 ? m + 1440 : m; if (mm >= b.s && mm < b.e) cur = b; else if (b.s > mm && !next) next = b; }
    return { cur, next, blocks: bl };
  }
  function dayStrip() {
    if (!S.planApplied) return '';
    const { cur, next, blocks } = nowBlock();
    const label = { family: 'Family', sd: 'System design', dsa: 'DSA', health: 'Health', rev: 'Revision', office: 'Office', wind: 'Wind down', sleep: 'Sleep', life: '', break: '' };
    return '<div class="daystrip"><div class="ds-now">' + (cur ? '<span class="ds-k k-' + cur.kind + '">Now</span><b>' + esc(cur.title) + '</b> until ' + ampm(cur.e) : '<span class="ds-k">Now</span><b>Free time</b>') +
      (next ? '<span class="ds-next">Next: ' + esc(next.title) + ' at ' + ampm(next.s) + '</span>' : '') + '</div>' +
      '<div class="ds-bar">' + blocks.filter((b) => b.kind !== 'break' && b.kind !== 'sleep').map((b) => '<span class="seg k-' + b.kind + (b === cur ? ' cur' : '') + '" style="flex:' + Math.max(15, b.e - b.s) + '" title="' + esc(ampm(b.s) + ' ' + b.title) + '"></span>').join('') + '</div>' +
      '<a class="ds-link" href="plan.html">See my day plan</a></div>';
  }
  /** What the mentor says depends on where you are in your day. */
  function scheduleNote(i) {
    if (!S.planApplied) return null;
    const { cur, next } = nowBlock(); if (!cur) return null;
    const p = buildPlan(); const sd = p.weekday.find((x) => x.kind === 'sd');
    if (cur.kind === 'office') return 'You’re at work until ' + ampm(cur.e) + '. Do it well; it pays for everything else. ' + (i.status === 'ok' ? 'Today’s prep is already done.' : 'If today is still open, the 10-minute version after office is enough. Tomorrow, deep work at ' + ampm(sd.s) + '.');
    if (cur.kind === 'family') return 'Family time. ' + her().charAt(0).toUpperCase() + her().slice(1) + ' first; the laptop can wait' + (next && (next.kind === 'sd' || next.kind === 'dsa') ? ' until ' + ampm(next.s) + '.' : '.');
    if (cur.kind === 'sleep' || cur.kind === 'life' && new Date().getHours() < 5) return 'It’s late. Sleep is part of the plan. Tomorrow’s deep work needs it.';
    if (cur.kind === 'sd' && !i.sdDone) return 'This is your system design block. Start now; the timer stops by itself at ' + cap() + ' minutes.';
    if (cur.kind === 'dsa' && !i.dsaDone) return 'DSA block: one question, 25 minutes, out loud.';
    return null;
  }

  // ---------- career timeline: counted back from the offer date ----------
  function careerSteps() {
    const T = S.profile.targetDate; if (!T) return [];
    const w = (n) => addDays(T, -7 * n);
    return [
      { id: 'c-habit', from: null, to: w(36), title: 'Foundations and the habit', d: 'Levels 1 and 2: distributed systems basics, storage formats, streaming. Easy DSA. No zero days.' },
      { id: 'c-depth', from: w(36), to: w(24), title: 'Depth', d: 'Spark, Kafka/Flink, modelling, CDC, staff-level judgement. Design cases one part a day.' },
      { id: 'c-stories', from: w(24), to: w(14), title: 'Full designs and your story bank', d: 'Two scored design cases a week. Write up the 5 or 6 biggest systems from your 10 years, with real numbers and incidents.', task: 'Story bank: 6 project write-ups done' },
      { id: 'c-resume', from: w(14), to: w(12), title: 'Resume and LinkedIn', d: 'Rewrite your resume around impact and scale, not client names. Product recruiters search LinkedIn; make yours say “data platform”, “streaming”, “staff”.', task: 'Resume and LinkedIn rewritten' },
      { id: 'c-refer', from: w(12), to: w(6), title: 'Referrals and mocks', d: 'Message ex-colleagues now at product companies; referrals move faster than job portals. One mock interview a week.', task: '5 referral conversations started' },
      { id: 'c-apply', from: w(6), to: T, title: 'Apply and interview', d: 'Apply in one batch so loops land together and offers can compete. Keep the daily habit at level 2 pace.', task: 'Applications sent' },
      { id: 'c-offer', from: T, to: null, title: 'Offer, negotiate, notice period', d: 'Compare offers on total compensation. Notice periods in India are often 60 to 90 days: plan the joining date with your family.' }
    ];
  }
  function careerTimeline() {
    const steps = careerSteps(); if (!steps.length) return '<p>Set your offer date on <a href="why.html">My why</a> and the timeline builds itself.</p>';
    const t = today(); S.career = S.career || {};
    return '<ol class="ctl">' + steps.map((s) => {
      const state = (s.to && t >= s.to) ? 'past' : (!s.from || t >= s.from) ? 'now' : 'next';
      return '<li class="' + state + '"><div class="ctl-when">' + (s.from ? shortDate(s.from) : 'Now') + (s.to ? ' → ' + shortDate(s.to) : '') + '</div><div><b>' + esc(s.title) + (state === 'now' ? ' <span class="here">You are here</span>' : '') + '</b><p>' + esc(s.d) + '</p>' +
        (s.task ? '<label class="inline"><input type="checkbox" data-ctask="' + s.id + '"' + (S.career[s.id] || (s.id === 'c-stories' && strongStories() >= 6) ? ' checked' : '') + '> ' + esc(s.task) + '</label>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }
  function dur(b) {
    let m = b.e - b.s;
    if (b.kind === 'sleep') { const l = life(); m = ((toMin(l.wake, 450) + 1440 - toMin(l.sleep, 30)) % 1440); }
    return m >= 90 ? (Math.round(m / 30) / 2) + ' h' : Math.round(m / 5) * 5 + ' min';
  }
  function renderPlan() {
    const p = buildPlan(); const l = p.l;
    const lh = document.getElementById('lede-hours'); if (lh) lh.textContent = ampm(toMin(l.officeStart, 870)) + ' to ' + ampm(toMin(l.officeEnd, 1410));
    const f = document.getElementById('lifeform');
    if (f && !f.dataset.ready) {
      ['officeStart', 'officeEnd', 'wake', 'sleep'].forEach((k) => { f.elements[k].value = l[k]; });
      f.elements.commute.value = l.commute;
      f.dataset.ready = '1';
      f.onsubmit = (e) => {
        e.preventDefault();
        S.profile.life = { officeStart: f.elements.officeStart.value || '14:30', officeEnd: f.elements.officeEnd.value || '23:30', commute: Math.max(0, Math.min(180, +f.elements.commute.value || 0)), wake: f.elements.wake.value || '07:30', sleep: f.elements.sleep.value || '00:30', weekendOff: true };
        applyPlan(false); renderPlan();
      };
    }
    const tl = (blocks) => '<ol class="tline">' + blocks.map((b) => '<li class="k-' + b.kind + '"><span class="tl-t">' + ampm(b.s) + '</span><div><b>' + esc(b.title) + '</b><span class="tl-d">' + dur(b) + '</span>' + (b.why ? '<p>' + esc(b.why) + '</p>' : '') + '</div></li>').join('') + '</ol>';
    document.getElementById('weekday').innerHTML = tl(p.weekday);
    document.getElementById('weekend').innerHTML = '<h3>Saturday</h3>' + tl(p.sat) + '<h3 style="margin-top:18px">Sunday</h3>' + tl(p.sun);
    const wkMin = p.budget.weekday * 5 + p.budget.sat + p.budget.sun;
    const famMin = p.weekday.filter((b) => b.kind === 'family').reduce((a, b) => a + b.e - b.s, 0);
    document.getElementById('budget').innerHTML = '<div class="bud"><b>' + fmtH(wkMin) + '</b><span>prep a week at full pace</span></div><div class="bud"><b>' + fmtH(famMin) + '</b><span>with family every office day</span></div><div class="bud"><b>' + fmtH(((toMin(l.wake, 450) + 1440 - toMin(l.sleep, 30)) % 1440)) + '</b><span>sleep a night</span></div>';
    document.getElementById('applied').innerHTML = S.planApplied ? 'Your reminders follow this plan since ' + new Date(S.planApplied).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '. <a href="settings.html">See them</a>.' : '';
    document.getElementById('career').innerHTML = careerTimeline();
    document.querySelectorAll('[data-ctask]').forEach((c) => { c.onchange = () => { S.career = S.career || {}; S.career[c.dataset.ctask] = c.checked ? Date.now() : 0; save(); if (c.checked) showCoachCard('Ticked off. Every checkpoint brings the offer closer, one step at a time.'); }; });
  }
  function initPlan() { refresh = renderPlan; renderPlan(); }

  // ---------- career kit: story bank, mock interviews, commitment, accountability ----------
  const STORY_FIELDS = [
    ['problem', 'The problem', 'What was broken or needed, for whom, and why it mattered. One or two sentences.'],
    ['scale', 'Scale, in numbers', 'Events per day, TB, tables, pipelines, users, latency, cost. Numbers are what make it staff-level.'],
    ['role', 'Your role', 'What YOU owned, not the team or the client. Use “I”.'],
    ['decisions', 'Key decisions', 'The 2 or 3 technical calls you made, and the alternatives you rejected.'],
    ['tradeoffs', 'Trade-offs and what went wrong', 'What you gave up, the incident or setback, and how you handled it.'],
    ['impact', 'Impact, measured', 'Cost saved, latency cut, freshness, reliability, people unblocked. With numbers.'],
    ['change', 'What you would do differently', 'Staff candidates always have an honest answer here.']
  ];
  const STORY_TAGS = ['Ownership', 'Ambiguity', 'Scale', 'Influence without authority', 'Mentoring', 'Incident', 'Cost', 'Migration'];
  function storyStrength(s) {
    let pts = 0;
    STORY_FIELDS.forEach(([k]) => { const v = (s[k] || '').trim(); if (v.length >= 40) pts += 12; else if (v) pts += 6; });
    if (/\d/.test(s.scale || '')) pts += 8;
    if (/\d/.test(s.impact || '')) pts += 8;
    return Math.min(100, pts);
  }
  const strongStories = () => (S.stories || []).filter((s) => storyStrength(s) >= 80).length;
  const MOCK_SCORES = ['', 'Strong no hire', 'Lean no hire', 'Lean hire', 'Strong hire'];
  const MOCK_TYPES = { sd: 'System design', dsa: 'DSA', deep: 'Project deep dive', beh: 'Behavioural' };

  function openStory(id) {
    S.stories = S.stories || [];
    const s = S.stories.find((x) => x.id === id) || { id: 'st' + Date.now(), title: '', org: '', tags: [] };
    let d = document.getElementById('storydlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'storydlg'; document.body.appendChild(d); }
    d.innerHTML = '<form class="dlg" id="storyform"><div class="dlg-head"><div><p class="muted small" style="margin:0">Story bank</p><h2>' + (s.title ? esc(s.title) : 'A system you built') + '</h2></div><button class="btn quiet" type="button" data-close aria-label="Close">Close</button></div>' +
      '<p class="coach-inline"><span class="coach-av sm" aria-hidden="true">' + MARK + '</span>Talk it through with the 🎤 if typing feels slow. Write it the way you would say it in the interview.</p>' +
      '<div class="row"><div class="field"><label for="sf-title">Title</label><input id="sf-title" name="title" value="' + esc(s.title) + '" placeholder="e.g. Real-time claims pipeline on Kafka and Spark"></div>' +
      '<div class="field"><label for="sf-org">Where (optional, keep clients anonymous)</label><input id="sf-org" name="org" value="' + esc(s.org) + '" placeholder="e.g. US health insurer, 2023"></div></div>' +
      STORY_FIELDS.map(([k, l, h]) => '<div class="field"><label for="sf-' + k + '">' + l + '</label><textarea id="sf-' + k + '" name="' + k + '" rows="3" placeholder="' + esc(h) + '">' + esc(s[k] || '') + '</textarea></div>').join('') +
      '<fieldset class="field tagset"><legend>Staff signals this story shows</legend>' + STORY_TAGS.map((t) => '<label class="inline"><input type="checkbox" name="tag" value="' + t + '"' + ((s.tags || []).includes(t) ? ' checked' : '') + '> ' + t + '</label>').join('') + '</fieldset>' +
      '<div class="actions"><button class="btn primary" type="submit">Save story</button>' + (S.stories.find((x) => x.id === s.id) ? '<button class="btn" type="button" id="sf-del">Delete</button>' : '') + '</div></form>';
    const f = d.querySelector('#storyform');
    f.onsubmit = (e) => {
      e.preventDefault();
      const n = { id: s.id, title: f.elements.title.value.trim() || 'Untitled story', org: f.elements.org.value.trim(), tags: [...f.querySelectorAll('input[name=tag]:checked')].map((x) => x.value), updated: Date.now(), practiced: s.practiced || [] };
      STORY_FIELDS.forEach(([k]) => { n[k] = f.elements[k].value.trim(); });
      S.stories = S.stories.filter((x) => x.id !== n.id).concat([n]); save(); d.close();
      const st = storyStrength(n);
      showCoachCard(st >= 80 ? 'That is an interview-ready story. Now say it out loud in 3 minutes, twice this week.' : 'Saved at ' + st + '%. The fastest way up: add real numbers to scale and impact, and say what you would do differently.');
      checkProgress(); refresh();
    };
    const del = d.querySelector('#sf-del');
    if (del) del.onclick = () => { if (confirm('Delete this story?')) { S.stories = S.stories.filter((x) => x.id !== s.id); save(); d.close(); refresh(); } };
    if (!d.open) d.showModal();
  }
  function openMock(id) {
    S.mocks = S.mocks || [];
    const m = S.mocks.find((x) => x.id === id) || { id: 'mk' + Date.now(), date: today(), type: 'sd', with: '', score: 3 };
    let d = document.getElementById('mockdlg');
    if (!d) { d = document.createElement('dialog'); d.id = 'mockdlg'; document.body.appendChild(d); }
    d.innerHTML = '<form class="dlg" id="mockform"><div class="dlg-head"><div><p class="muted small" style="margin:0">Mock interview</p><h2>How did it go?</h2></div><button class="btn quiet" type="button" data-close aria-label="Close">Close</button></div>' +
      '<div class="row"><div class="field"><label for="mf-date">Date</label><input id="mf-date" name="date" type="date" value="' + m.date + '"></div>' +
      '<div class="field"><label for="mf-type">Round</label><select id="mf-type" name="type">' + Object.entries(MOCK_TYPES).map(([k, v]) => '<option value="' + k + '"' + (k === m.type ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mf-with">With</label><input id="mf-with" name="with" value="' + esc(m.with) + '" placeholder="Ex-colleague at Uber, a mock platform…"></div></div>' +
      '<fieldset class="field scoreset"><legend>The interviewer’s verdict, honestly</legend>' + [1, 2, 3, 4].map((v) => '<label><input type="radio" name="score" value="' + v + '"' + (+m.score === v ? ' checked' : '') + '><span>' + MOCK_SCORES[v] + '</span></label>').join('') + '</fieldset>' +
      '<div class="field"><label for="mf-well">What went well</label><textarea id="mf-well" name="well" rows="2">' + esc(m.well || '') + '</textarea></div>' +
      '<div class="field"><label for="mf-fix">What to fix before the next one</label><textarea id="mf-fix" name="fix" rows="2">' + esc(m.fix || '') + '</textarea></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Save mock</button></div></form>';
    d.querySelector('#mockform').onsubmit = (e) => {
      e.preventDefault(); const f = e.target;
      const n = { id: m.id, date: f.elements.date.value || today(), type: f.elements.type.value, with: f.elements.with.value.trim(), score: +(f.querySelector('input[name=score]:checked') || {}).value || 0, well: f.elements.well.value.trim(), fix: f.elements.fix.value.trim(), at: Date.now() };
      S.mocks = S.mocks.filter((x) => x.id !== n.id).concat([n]); save(); d.close();
      showCoachCard(n.score >= 3 ? 'A hire signal. Note exactly what worked; that is your interview style now.' : 'A “no hire” in a mock is the cheapest lesson you will ever get. Fix one thing: “' + (n.fix || 'the weakest moment') + '”, then book the next one.');
      checkProgress(); refresh();
    };
    if (!d.open) d.showModal();
  }
  function weeklyReportText() {
    const w = weekStats(weekStart(today())); const lw = weekStats(addDays(weekStart(today()), -7)); const r = readiness(); const pc = pace();
    const plan = latestPlan();
    return 'DataLeap weekly check-in, ' + (me() || 'Sourav') + '\n' +
      'Last week: ' + fmtH(lw.min) + ', ' + lw.complete + '/7 days complete (system design ' + fmtH(lw.sd) + ', DSA ' + fmtH(lw.dsa) + ')\n' +
      'This week so far: ' + fmtH(w.min) + ', ' + w.complete + ' days\n' +
      'Streak: ' + streak() + ' days · Total: ' + (Math.round(pc.doneH * 10) / 10) + ' of ' + pc.goal + ' hours\n' +
      'Interview readiness: ' + r.score + '% (' + r.label + ')\n' +
      'Story bank: ' + strongStories() + '/6 ready · Mocks done: ' + (S.mocks || []).length + '\n' +
      (plan ? 'My change for this week: ' + plan + '\n' : '') +
      (S.profile.targetDate ? 'Offer target: ' + niceDate(S.profile.targetDate) + ' (' + Math.max(0, daysBetween(today(), S.profile.targetDate)) + ' days)\n' : '') +
      'Ask me about it if these numbers drop.';
  }
  function shareText(text) {
    if (BR && BR.share) { BR.share(text); return; }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it in WhatsApp.'), () => toast('Could not copy.'));
  }
  function coachPlanHTML() {
    const c = CP();
    if (!c) return '<p>Import your private <b>career pack</b> (button under the story bank) and this becomes your personal coaching plan: your strengths, the gaps staff loops will probe, and which of your own systems become interview answers.</p>';
    const fz = focusNow(); const storyPct = (sid) => { const s = (S.stories || []).find((x) => x.id === sid); return s ? storyStrength(s) : null; };
    return '<p class="plan-lead">' + esc(c.headline) + '</p><p class="small muted" style="margin-top:-6px">' + esc(c.current) + ' · ' + esc(c.path) + '</p>' +
      '<div class="cols plan-cols"><div><h3>Already strong</h3><ul class="plainlist">' + (c.strengths || []).map((x) => '<li><b>' + esc(x.area) + '.</b> ' + esc(x.evidence) + '</li>').join('') + '</ul></div>' +
      '<div><h3>Gaps to close, in this order</h3><ol class="gaplist">' + (c.gaps || []).map((g) => { const its = D.items.filter((i) => i.topic === g.topic); const done = its.filter((i) => ['done', 'mastered'].includes(st(i.id).status)).length; return '<li><b>' + esc(g.title) + '</b>' + (its.length ? ' <span class="chip">' + done + '/' + its.length + '</span>' : '') + '<span>' + esc(g.why) + '</span><span class="gap-act">' + esc(g.action) + '</span></li>'; }).join('') + '</ol></div></div>' +
      '<h3>Your systems are your interview answers</h3><div class="tablewrap"><table class="dtable"><thead><tr><th>Interview case</th><th>What you built</th><th>Case</th><th>Your story</th></tr></thead><tbody>' +
      (c.experience || []).map((e) => { const it = byId[e.case]; if (!it) return ''; const sp = storyPct(e.story); return '<tr><td><button class="linkish" data-open="' + it.id + '">' + esc(it.title) + '</button></td><td class="small">' + esc(e.from) + '</td><td><span class="chip st-' + st(it.id).status + '">' + STATUS_LABEL[st(it.id).status] + '</span></td><td>' + (sp === null ? '—' : '<span class="chip ' + (sp >= 80 ? 'st-done' : 'st-in_progress') + '">' + sp + '%</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<h3>Where to apply first</h3><div class="fitgrid">' + (c.companies || []).map((x) => '<div class="fit"><b>' + esc(x.name) + '</b><span class="chip">' + esc(x.fit) + '</span><p>' + esc(x.why) + '</p></div>').join('') + '</div>' +
      '<h3>Your next 90 days</h3><div class="fitgrid">' + (c.focus90 || []).map((m) => '<div class="fit' + (fz && fz.month === m.month ? ' now' : '') + '"><b>Month ' + m.month + ': ' + esc(m.title) + '</b>' + (fz && fz.month === m.month ? '<span class="chip st-done">Now</span>' : '') + '<ul>' + m.items.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>').join('') + '</div>';
  }
  function renderCareer() {
    const p = S.profile; S.stories = S.stories || []; S.mocks = S.mocks || [];
    const cpl = document.getElementById('coachplan'); if (cpl) cpl.innerHTML = coachPlanHTML();
    const cm = document.getElementById('commit');
    if (cm) {
      const def = 'For the next 12 months I will put about 10 hours a week into preparation, protect my mornings with ' + her() + ', keep my sleep, and start applying by ' + (pace().applyBy ? niceDate(pace().applyBy) : 'my apply date') + '. I will not quit on a bad week.';
      cm.innerHTML = p.committedAt
        ? '<blockquote class="commitq">' + esc(p.commitment) + '<footer>Signed by ' + esc(me() || 'you') + ', ' + new Date(p.committedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + '</footer></blockquote><button class="btn small" type="button" id="cm-edit">Edit commitment</button>'
        : '<form id="cmform"><div class="field"><label for="cm-t">My commitment</label><textarea id="cm-t" name="t" rows="4">' + esc(p.commitment || def) + '</textarea></div><button class="btn haldi" type="submit">Sign it</button></form>';
      const f = document.getElementById('cmform');
      if (f) f.onsubmit = (e) => { e.preventDefault(); p.commitment = f.elements.t.value.trim(); p.committedAt = Date.now(); save(); renderCareer(); showCoachCard('Signed. People keep promises they write down and share. Send it to your accountability partner below.'); };
      const ed = document.getElementById('cm-edit'); if (ed) ed.onclick = () => { p.committedAt = 0; save(); renderCareer(); };
    }
    const sl = document.getElementById('stories');
    if (sl) sl.innerHTML = '<p class="muted" style="margin:0 0 12px">' + strongStories() + ' of 6 interview-ready. A story is ready at 80%: every section filled, with real numbers.</p>' +
      (S.stories.length ? '<div class="storygrid">' + S.stories.slice().sort((a, b) => b.updated - a.updated).map((s) => { const st = storyStrength(s); return '<div class="story"><div class="story-top"><b>' + esc(s.title) + '</b><span class="chip ' + (st >= 80 ? 'st-done' : 'st-in_progress') + '">' + st + '%</span></div>' + (s.org ? '<small>' + esc(s.org) + '</small>' : '') + '<div class="bar"><i style="width:' + st + '%"></i></div>' + ((s.tags || []).length ? '<p class="story-tags">' + s.tags.map(esc).join(' · ') + '</p>' : '') + '<div class="actions"><button class="btn small" type="button" data-story="' + s.id + '">Edit</button><button class="btn small primary" type="button" data-practise="' + s.id + '">Practise out loud</button></div>' + ((s.practiced || []).length ? '<small>Practised ' + s.practiced.length + ' time' + (s.practiced.length > 1 ? 's' : '') + '</small>' : '') + '</div>'; }).join('') + '</div>' : '') +
      '<p class="actions" style="margin:14px 0 0">' + (S.stories.length < 12 ? '<button class="btn haldi" type="button" data-story="">Add a story</button>' : '') +
      '<label class="btn" for="st-import" style="margin:0">Import career pack or stories</label><input id="st-import" type="file" accept="application/json,.json" hidden>' +
      (S.stories.length ? '<button class="btn" type="button" id="st-export">Export stories</button>' : '') + '</p>';
    const si = document.getElementById('st-import');
    if (si) si.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return; const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result); const list = Array.isArray(d) ? d : (d.stories || []);
          let gotProfile = false;
          if (d && d.type === 'dataleap-career-pack' && d.profile) {
            S.coach = Object.assign({}, d.profile, { importedAt: (S.coach && S.coach.importedAt) || Date.now() });
            if (d.profile.years) S.profile.years = d.profile.years;
            gotProfile = true;
          }
          if (!Array.isArray(list)) throw 0;
          let added = 0;
          list.forEach((x) => {
            if (!x || !x.title) return;
            const id = String(x.id || ('st' + Date.now() + added));
            if (S.stories.some((y) => y.id === id)) return; // never overwrite what you already wrote
            const n = { id, title: String(x.title), org: String(x.org || ''), tags: Array.isArray(x.tags) ? x.tags.filter((t) => STORY_TAGS.includes(t)) : [], updated: Date.now(), practiced: [] };
            STORY_FIELDS.forEach(([k]) => { n[k] = String(x[k] || ''); });
            S.stories.push(n); added++;
          });
          save(); renderCareer();
          if (gotProfile) { showCoachCard('I’ve read your career. Your coaching plan is at the top of this page: what you are already strong in, the gaps staff loops will probe, and which of your own systems become interview answers. Today now starts from your gaps.'); return; }
          showCoachCard(added ? added + ' story drafts imported from your career. Each one is a deep-dive answer waiting to be finished: add the scale, your decisions and what you would change.' : 'Nothing new to import: those stories are already here.');
          checkProgress();
        } catch (err) { toast('That file is not a DataLeap story file.'); }
      };
      rd.readAsText(file);
    };
    const sx = document.getElementById('st-export');
    if (sx) sx.onclick = () => {
      const json = JSON.stringify({ type: 'dataleap-stories', stories: S.stories }, null, 2);
      if (BR) { BR.saveFile('dataleap-stories-' + today() + '.json', 'application/json', json); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'dataleap-stories-' + today() + '.json'; a.click();
    };
    const ml = document.getElementById('mocks');
    if (ml) {
      const ms = S.mocks.slice().sort((a, b) => (b.date > a.date ? 1 : -1));
      const hires = ms.filter((m) => m.score >= 3).length;
      ml.innerHTML = '<p class="muted" style="margin:0 0 12px">' + ms.length + ' done, ' + hires + ' with a hire signal. Aim for 8 before you apply: 4 system design, 2 DSA, 2 project deep dives.</p>' +
        (ms.length ? '<div class="tablewrap"><table class="dtable"><thead><tr><th>Date</th><th>Round</th><th>With</th><th>Verdict</th><th>Fix next</th><th></th></tr></thead><tbody>' + ms.map((m) => '<tr><td>' + shortDate(m.date) + '</td><td>' + MOCK_TYPES[m.type] + '</td><td>' + esc(m.with || '—') + '</td><td><span class="chip ' + (m.score >= 3 ? 'st-done' : 'st-not_solved') + '">' + (MOCK_SCORES[m.score] || '—') + '</span></td><td class="small">' + esc(m.fix || '') + '</td><td><button class="linkish small" data-mock="' + m.id + '">Edit</button></td></tr>').join('') + '</tbody></table></div>' : '') +
        '<p style="margin:14px 0 0"><button class="btn primary" type="button" data-mock="">Log a mock interview</button></p>';
    }
    const ac = document.getElementById('account');
    if (ac) {
      ac.innerHTML = '<div class="row"><div class="field"><label for="ac-p">Accountability partner</label><input id="ac-p" value="' + esc(p.partner || '') + '" placeholder="Your wife, a friend, an ex-colleague at a product company"></div><div class="field" style="flex:0 0 auto"><button class="btn" type="button" id="ac-save">Save</button></div></div>' +
        '<pre class="report-text" id="ac-text">' + esc(weeklyReportText()) + '</pre>' +
        '<div class="actions"><button class="btn haldi" type="button" id="ac-share">Share this week’s check-in' + (p.partner ? ' with ' + esc(p.partner) : '') + '</button></div>' +
        '<p class="small muted">Send it every Sunday after your retrospective. Someone who expects the message is the strongest reminder there is.</p>';
      document.getElementById('ac-save').onclick = () => { p.partner = document.getElementById('ac-p').value.trim(); save(); renderCareer(); toast('Saved'); };
      document.getElementById('ac-share').onclick = () => { S.lastShare = Date.now(); save(); shareText(weeklyReportText()); };
    }
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-story]'); if (a) { e.preventDefault(); openStory(a.dataset.story); return; }
    const b = e.target.closest('[data-mock]'); if (b) { e.preventDefault(); openMock(b.dataset.mock); return; }
    const c = e.target.closest('[data-practise]');
    if (c) {
      e.preventDefault(); const s = (S.stories || []).find((x) => x.id === c.dataset.practise); if (!s) return;
      s.practiced = (s.practiced || []).concat([Date.now()]); save();
      startTimer('sd', null, { part: 'Story: ' + s.title });
      showCoachCard('Out loud, 3 minutes: problem and scale, your decisions, trade-offs, impact, what you would change. Record it on your phone and listen once.');
    }
  });
  function initCareer() { refresh = renderCareer; renderCareer(); }

  // ---------- Android bridge sync ----------
  let lastRem = '', lastQ = '', lastMo = '';
  function syncNative() {
    if (!BR) return;
    try {
      const t = today(); const i = dayInfo(t); const sd = suggest('sd'); const ds = suggest('dsa');
      const wkStart = addDays(t, -((dow(t) + 6) % 7)); let weekMin = 0, weekComplete = 0;
      S.sessions.forEach((x) => { if (x.date >= wkStart && x.date <= t) weekMin += x.minutes; });
      for (let d = wkStart; d <= t; d = addDays(d, 1)) if (dayInfo(d).status === 'ok') weekComplete++;
      BR.setDayState(JSON.stringify({ date: t, sdDone: i.sdDone, dsaDone: i.dsaDone, status: i.status, rest: S.rest.includes(t), missedYesterday: missedYesterday(),
        sdNext: sd ? sd.item.title : '', dsaNext: ds ? ds.item.title : '', dayStart: S.settings.dayStart, min: minNow(), name: daughter(), weekMin, weekComplete, streak: streak() }));
      const mo = JSON.stringify(S.settings.motiv); if (mo !== lastMo) { lastMo = mo; if (BR.setMotivation) BR.setMotivation(mo); }
      const r = JSON.stringify(S.reminders); if (r !== lastRem) { lastRem = r; BR.setReminders(r); }
      const qo = {}; Object.keys(D.quotes).forEach((k) => { qo[k] = D.quotes[k].map(personal); });
      const q = JSON.stringify(qo); if (q !== lastQ) { lastQ = q; BR.setQuotes(q); }
    } catch (e) {}
  }

  // ---------- boot ----------
  checkProgress();
  renderChrome();
  const page = document.body.dataset.page;
  if (!S.planApplied) {
    applyPlan(true);
    setTimeout(() => showCoachCard('I’ve planned your day around your ' + ampm(toMin(life().officeStart, 870)) + ' to ' + ampm(toMin(life().officeEnd, 1410)) + ' office shift: family first in the morning, deep work before office, nothing heavy after it, sleep by ' + ampm(toMin(life().sleep, 30)) + '. Tap to see it.', () => { location.href = 'plan.html'; }), 1500);
  }
  if (page === 'home') initHome();
  else if (page === 'dsa') initList('dsa');
  else if (page === 'sd') initList('sd');
  else if (page === 'progress') initProgress();
  else if (page === 'settings') initSettings();
  else if (page === 'why') initWhy();
  else if (page === 'lib') initLib();
  else if (page === 'plan') initPlan();
  else if (page === 'career') initCareer();
  tick();
  setInterval(() => { tick(); updateCountdown(); }, 1000);
  setInterval(checkReminders, 20000);
  checkReminders();
  window.addEventListener('storage', () => { S = load(); refresh(); tick(); });
  window.dlResume = () => { S = loadBest(); refresh(); tick(); checkProgress(); syncNative(); if (window.dlSettingsRedraw) window.dlSettingsRedraw(); if (window.dlVoiceResume) window.dlVoiceResume(); };
  syncNative();
})();
