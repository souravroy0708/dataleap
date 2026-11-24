/* DataLeap. In the Android app all data lives in the phone's database (SQLite via window.AndroidBridge);
   on the website it lives in this browser's localStorage.
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
      // Your plan by default. Friends can change everything on My why, My day and Fitness, or rerun setup.
      me: 'Sourav', years: 10, companyType: 'service', motive: { relation: 'daughter', name: '', age: 2.5, ageAt: Date.now(), pronoun: '' },
      life: { officeStart: '14:30', officeEnd: '23:30', commute: 30, wake: '07:30', sleep: '00:30', workDays: [1, 2, 3, 4, 5] },
      why: '', role: 'Staff Data Engineer', companies: 'Google, Uber, Databricks, Visa', targetDate: '2027-10-31', hoursGoal: 450, weeklyHours: 10,
      fit: { on: true, startKg: 72, goalKg: 65, goalDate: '2027-04-30', gymDays: [1, 2, 4, 5, 6], gymMin: 60, rotation: { 1: 'A', 2: 'B', 4: 'A', 5: 'B', 6: 'C' }, steps: 9000 },
      vision: {},
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
  // ---------- storage: phone database in the app, browser storage on the website ----------
  const kvGet = (k) => { if (BR && BR.kvGet) { try { return BR.kvGet(k) || null; } catch (e) { return null; } } return localStorage.getItem(k); };
  const kvSet = (k, v) => { if (BR && BR.kvSet) { try { BR.kvSet(k, v); } catch (e) {} return; } localStorage.setItem(k, v); };
  const kvDel = (k) => { if (BR && BR.kvDel) { try { BR.kvDel(k); } catch (e) {} return; } localStorage.removeItem(k); };
  function readRaw() {
    if (BR && BR.dbLoad) { try { return BR.dbLoad() || ''; } catch (e) { return ''; } }
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function load(rawStr) {
    const d = defaults();
    let raw = {};
    try { raw = JSON.parse((rawStr === undefined ? readRaw() : rawStr) || '{}'); } catch (e) { raw = {}; }
    const s = Object.assign(d, raw);
    s.settings = Object.assign(defaults().settings, raw.settings || {});
    s.settings.manual = Object.assign(defaults().settings.manual, (raw.settings || {}).manual || {});
    s.settings.motiv = Object.assign(defaults().settings.motiv, (raw.settings || {}).motiv || {});
    s.profile = Object.assign(defaults().profile, raw.profile || {});
    s.profile.vision = Object.assign({}, (raw.profile || {}).vision || {});
    s.profile.motive = Object.assign(defaults().profile.motive, (raw.profile || {}).motive || {});
    // Older versions stored one person (a daughter) as profile.name / herAge: move it into the motive model once.
    const rp = raw.profile || {};
    if (!((raw.profile || {}).motive) && (rp.name || rp.herAge !== undefined) && raw.sessions) {
      s.profile.motive = { relation: 'daughter', name: rp.name || '', age: rp.herAge === undefined ? '' : rp.herAge, ageAt: rp.herAgeAt || 0, pronoun: '' };
    }
    if (s.profile.vision.daughter && !s.profile.vision.them) { s.profile.vision.them = s.profile.vision.daughter; delete s.profile.vision.daughter; }
    if (s.setupDone === undefined) s.setupDone = true; // personal build: straight into your plan
    s.profile.fit = Object.assign(defaults().profile.fit, (raw.profile || {}).fit || {});
    if (raw.planApplied && s.setupDone === undefined) s.setupDone = true;
    s.hit = s.hit || {}; s.fired = s.fired || {};
    return s;
  }
  /** App: the phone database is the only store. Anything left in browser storage from older versions moves in once, then is deleted. */
  function loadBest() {
    if (BR && BR.dbLoad) {
      try {
        const ls = localStorage.getItem(KEY);
        if (ls) {
          const db = BR.dbLoad(); const a = JSON.parse(ls); const b = db ? JSON.parse(db) : null;
          const lsNewer = !b || (a.updatedAt || 0) > (b.updatedAt || 0) || ((!b.sessions || !b.sessions.length) && a.sessions && a.sessions.length);
          if (lsNewer) BR.dbSave(ls);
          localStorage.removeItem(KEY);
        }
        const lt = localStorage.getItem(TKEY);
        if (lt) { if (BR.kvSet) BR.kvSet(TKEY, lt); localStorage.removeItem(TKEY); }
      } catch (e) {}
    }
    return load();
  }
  let S = loadBest();
  let syncT;
  let dbT;
  const save = () => {
    S.updatedAt = Date.now();
    const json = JSON.stringify(S);
    if (BR && BR.dbSave) {
      try { BR.dbSave(json); } catch (e) { toast('Could not save to the phone database.'); }
      clearTimeout(syncT); syncT = setTimeout(syncNative, 250);
    } else {
      try { localStorage.setItem(KEY, json); } catch (e) { toast('Could not save: storage is full or blocked.'); }
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
  // ---------- who you are doing this for: relation, names, pronouns ----------
  const REL = {
    daughter: { label: 'My daughter', def: 'your daughter', p: 'she', child: true },
    son: { label: 'My son', def: 'your son', p: 'he', child: true },
    children: { label: 'My children', def: 'your children', p: 'they', child: true },
    parents: { label: 'My parents', def: 'your parents', p: 'they' },
    mother: { label: 'My mother', def: 'your mother', p: 'she' },
    father: { label: 'My father', def: 'your father', p: 'he' },
    wife: { label: 'My wife', def: 'your wife', p: 'she' },
    husband: { label: 'My husband', def: 'your husband', p: 'he' },
    partner: { label: 'My partner', def: 'your partner', p: 'they' },
    family: { label: 'My family', def: 'your family', p: 'they' },
    myself: { label: 'Myself', def: 'yourself', p: 'self' },
    other: { label: 'Someone else', def: 'the people you love', p: 'they' }
  };
  const motive = () => S.profile.motive || {};
  const rel = () => REL[motive().relation] || REL.family;
  const isSelf = () => motive().relation === 'myself';
  const isChild = () => !!rel().child;
  const daughter = () => (isSelf() ? '' : (motive().name || '').trim()); // the name you entered, if any
  const who = () => daughter() || rel().def;
  const Cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
  function pron() {
    const m = motive(); let p = m.pronoun || rel().p;
    if (/ and |,|&/.test(m.name || '') && p !== 'self') p = 'they';
    return p;
  }
  const PR = { she: ['she', 'her', 'her', 's'], he: ['he', 'him', 'his', 's'], they: ['they', 'them', 'their', ''], self: ['you', 'you', 'your', ''] };
  const yrsTxt = () => (S.profile.years ? String(S.profile.years) : '');
  function personal(t) {
    const y = yrsTxt();
    t = y ? t.replace(/\{years\}/g, y) : t.replace(/\{years\} years/g, 'your years').replace(/\{years\}/g, 'many');
    const [they, them, their, s] = PR[pron()] || PR.they;
    const n = who();
    return t.replace(/\{Name\}/g, Cap(n)).replace(/\{name\}/g, n)
      .replace(/\{They\}/g, Cap(they)).replace(/\{they\}/g, they).replace(/\{them\}/g, them)
      .replace(/\{Their\}/g, Cap(their)).replace(/\{their\}/g, their).replace(/\{s\}/g, s)
      .replace(/\{is\}/g, s ? 'is' : 'are').replace(/\{has\}/g, s ? 'has' : 'have').replace(/\{me\}/g, (S.profile.me || '').trim());
  }
  const famCat = (c) => (c === 'family' && isSelf() ? 'self' : c);

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
  const her = () => who();
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
      body = 'You bring ' + (yrsTxt() ? yrsTxt() + ' years' : 'years') + ' of real systems. What’s missing is only interview practice, and that we build daily. Today I’ll keep it small: ' + tg.sd + ' minutes of system design, ' + tg.dsa + ' of DSA. Start with “' + sdName + '”.';
    } else if (S.rest.includes(t) && i.status !== 'ok') {
      body = 'Rest day. Rest is part of the plan, not a break from it. ' + (isSelf() ? 'Recharge properly' : 'Be fully with ' + her()) + ' today; we go again tomorrow.';
    } else if (i.status === 'ok') {
      body = h >= 20 ? pickBy(k, [isSelf() ? 'Both done. You kept your word to yourself today. Close the laptop and rest.' : personal('Both done. You kept your word to {name} today. Close the laptop and go be with {them}.'), 'Day complete. ' + (sk > 1 ? sk + ' days in a row. ' : '') + 'The rest of tonight belongs to your family.'])
        : pickBy(k, ['Both done before evening. That is the kind of consistency interviewers can feel.', 'Day complete' + (sk > 1 ? ', ' + sk + ' in a row' : '') + '. Anything more today is a bonus, not a debt.']);
    } else if (missedYesterday()) {
      body = 'Yesterday slipped. It happens to everyone who is busy and still trying. What matters is today: ' + m + ' minutes on “' + sdName + '” and the habit is alive again.';
    } else if (i.sdDone && !i.dsaDone) {
      body = pickBy(k, ['System design is done. One DSA question and today is yours: “' + dsName + '”, ' + tg.dsa + ' minutes.', 'The hard part is done. Finish with “' + dsName + '” and close the day.']);
    } else if (i.dsaDone && !i.sdDone) {
      body = 'DSA done. Now the round that decides staff offers: “' + sdName + '”, ' + tg.sd + ' minutes.';
    } else if (h < 12) {
      body = pickBy(k + 'm', ['You already know how these systems run in production. Today, practise explaining one the way a product interviewer wants: “' + sdName + '”, ' + tg.sd + ' minutes.', (isSelf() ? 'Before the day takes over, give your future ' : 'Before the day takes over, give ' + her() + ' ') + tg.sd + ' minutes. Start with “' + sdName + '”.', 'Mornings are yours before they are anyone else’s. ' + tg.sd + ' minutes on “' + sdName + '” and the hardest part of today is done.']);
    } else if (h < 18) {
      body = pickBy(k, ['The day is half gone, the chance isn’t. ' + m + ' minutes now beats an hour you never find. Start with “' + sdName + '”.', 'Find one quiet slot in the next hour. “' + sdName + '”, ' + tg.sd + ' minutes. I’ll time it.']);
    } else {
      body = pickBy(k, ['I know you’re tired. ' + m + ' honest minutes still count, and they keep the promise you made to ' + (isSelf() ? 'yourself' : her()) + '.', 'Long day. Don’t aim for perfect, aim for done: ' + m + ' minutes on “' + sdName + '” and the streak lives.']);
    }
    let extra = '';
    if (i.status !== 'ok') {
      const nextM = Object.keys(D.milestones).map(Number).find((x) => x > sk);
      if (sk >= 2 && nextM && nextM - sk <= 2) extra = ' ' + (nextM - sk) + ' more day' + (nextM - sk > 1 ? 's' : '') + ' to a ' + nextM + '-day streak.';
      else if (sk >= 3) extra = ' ' + sk + ' days in a row so far. Don’t break it tonight.';
    }
    if (followUpsDue().length && i.status !== 'ok') extra += ' Also today: follow up with ' + followUpsDue().map((a) => a.company).slice(0, 2).join(' and ') + '.';
    const sc = skipCostDays();
    if (sc >= 0 && i.status !== 'ok' && !i.sdDone && !i.dsaDone && h >= 7 && h < 14) extra += ' Skipping today would push your finish about ' + halves(sc) + (sc <= 1 ? ' day' : ' days') + ' later.';
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
    if (after === 'ok' && before !== 'ok') return 'Day complete' + (me() ? ', ' + me() : '') + '. ' + (sk > 1 ? sk + '-day streak. ' : '') + (isSelf() ? 'This is how careers change: one finished day at a time.' : personal('{Name} will never see this hour, but {they} will live inside what it builds.'));
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
    return list[Math.floor(el / 180000) % list.length].replace('{her}', isSelf() ? 'your future' : her());
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
  const PAGE_QUOTES = { fit: ['habit', 'family'], career: ['switch', 'family'], plan: ['family', 'switch'], home: ['habit', 'family', 'switch'], lib: ['habit', 'sd'], sd: ['sd', 'switch'], dsa: ['dsa'], roadmap: ['habit', 'sd', 'switch'], why: ['family'], progress: ['habit', 'switch'], settings: ['habit'], companies: ['sd'] };
  let quoteShift = 0;
  function quoteFor(page, shift) {
    let cats = PAGE_QUOTES[page] || ['habit'];
    if (page === 'home' && missedYesterday()) cats = ['comeback'];
    const list = cats.flatMap((c) => D.quotes[famCat(c)]);
    let h = 0; const key = today() + page; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return personal(list[(h + (shift || 0)) % list.length]);
  }
  function randomQuote(cat) { const l = D.quotes[famCat(cat)]; return personal(l[Math.floor(Math.random() * l.length)]); }

  // ---------- chrome ----------
  const NAV = [['index.html', 'Today'], ['plan.html', 'My day'], ['system-design.html', 'System design'], ['dsa.html', 'DSA'], ['library.html', 'Library'], ['fit.html', 'Fitness'], ['career.html', 'Career kit'], ['why.html', 'My why'], ['progress.html', 'Progress'], ['settings.html', 'Reminders']];
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
    // Bottom tab bar on phones, like a native app
    const TABS = [['index.html', 'Today', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'], ['system-design.html', 'Learn', 'M4 6l8-3 8 3-8 3-8-3zm0 5l8 3 8-3M4 16l8 3 8-3'], ['fit.html', 'Fitness', 'M3 10v4M21 10v4M6 7v10M18 7v10M6 12h12'], ['career.html', 'Career', 'M9 6V4h6v2M4 7h16v12H4zM4 12h16'], ['progress.html', 'Progress', 'M5 20V10M12 20V4M19 20v-7']];
    if (page !== 'setup') {
      const tb = document.createElement('nav'); tb.className = 'tabbar'; tb.setAttribute('aria-label', 'Main');
      tb.innerHTML = TABS.map(([h, l, d]) => '<a href="' + h + '"' + (h === here || (h === 'system-design.html' && ['dsa.html', 'library.html'].includes(here)) ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg><span>' + l + '</span></a>').join('');
      document.body.appendChild(tb); document.body.classList.add('has-tabbar');
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
    const all = cats.flatMap((c) => D.quotes[famCat(c)]);
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
  const getT = () => { try { return JSON.parse(kvGet(TKEY) || 'null'); } catch (e) { return null; } };
  const setT = (t) => {
    if (t) kvSet(TKEY, JSON.stringify(t)); else kvDel(TKEY);
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
      (it.type === 'case' ? '<p><button class="btn haldi" type="button" data-mocksim="' + id + '">Practise as a 45-minute mock interview</button></p>' : '') +
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
    const p = S.profile; const n = isSelf() ? 'myself' : (motive().relation || daughter() ? who() : '');
    const left = p.targetDate ? daysBetween(today(), p.targetDate) : null;
    const hrs = Math.round(totalMinutes() / 6) / 10; const sk = streak();
    const c = coachMessage();
    return '<div class="coach"><span class="coach-av" aria-hidden="true">' + MARK + '</span><div class="coach-text"><p class="coach-label">Your coach</p><p class="coach-head">' + esc(c.head) + '</p><p class="coach-body">' + esc(c.body) + '</p></div></div>' +
      dayStrip() +
      '<p class="why-line">' + (p.why ? (n ? '<span>For ' + esc(n) + '</span> ' : '<span>Your why</span> ') + esc(p.why) : '<a href="why.html">Write your why</a>: who you are doing this for, and what this job changes for them.') + '</p>' +
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
    const fu = followUpsDue();
    if (fu.length) banner = '<div class="banner"><b>Follow up today:</b> ' + fu.map((a) => esc(a.company)).join(', ') + '. <a href="career.html#applications">Open applications</a></div>' + banner;
    if (BR && BR.exactAlarms && !BR.exactAlarms() && !sessionStorage.getItem('dl-exact-dismiss')) banner += '<div class="banner"><b>Reminders may arrive a few minutes late.</b> Allow “Alarms and reminders” so they fire on time. <button class="btn small primary" type="button" id="ex-allow">Allow</button> <button class="btn small quiet" type="button" id="ex-later">Later</button></div>';
    document.getElementById('banner').innerHTML = banner;
    const exa = document.getElementById('ex-allow'); if (exa) exa.onclick = () => BR.openExactAlarmSettings();
    const exl = document.getElementById('ex-later'); if (exl) exl.onclick = () => { sessionStorage.setItem('dl-exact-dismiss', '1'); renderHome(); };
    const fcEl = document.getElementById('fitrow'); if (fcEl) fcEl.innerHTML = fitCard();
    const qk = document.getElementById('quick');
    if (qk) { const nd = drillCards().length; qk.innerHTML = '<button class="qa" type="button" data-drill><b>2-minute drill</b><span>' + (nd ? nd + ' card' + (nd > 1 ? 's' : '') + ' due' : 'Recall your notes') + '</span></button><button class="qa" type="button" data-mocksim=""><b>Mock interview</b><span>45 min, system design</span></button><button class="qa" type="button" data-log="sd"><b>Log time</b><span>Studied off the timer?</span></button><a class="qa" href="career.html#applications"><b>Applications</b><span>' + (S.apps || []).filter((a) => !['target', 'closed'].includes(a.stage)).length + ' active</span></a>'; }
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
    document.getElementById('split').innerHTML = '<p class="coach-week">' + (ws + wd ? 'This week you gave ' + fmtH(ws + wd) + ' to ' + (isSelf() ? 'your future' : her() + '’s future') + ': ' + fmtH(ws) + ' of system design, ' + fmtH(wd) + ' of DSA.' + (ws < wd ? ' Shift a little more to system design; it decides staff offers.' : '') : 'Nothing logged this week yet. Ten minutes today changes that.') + '</p><div class="splitbar" role="img" aria-label="System design ' + Math.round((ws / tot) * 100) + ' percent"><span class="a" style="width:' + (ws / tot) * 100 + '%"></span><span class="b" style="width:' + (wd / tot) * 100 + '%"></span></div>';
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
      r.onload = () => { try { const d = JSON.parse(r.result); if (!d.sessions || !d.items) throw 0; S = load(JSON.stringify(d)); save(); renderProgress(); toast('Backup restored'); } catch (err) { toast('That file is not a DataLeap backup.'); } };
      r.readAsText(file);
    };
  }

  // ---------- My why ----------
  function visionFor(key) {
    const v = S.profile.vision || {};
    if (v[key] && v[key].length) return v[key];
    const r = motive().relation;
    if (key === 'them') {
      if (isSelf()) return [];
      if (isChild()) return ['{Their} education is planned and funded early, so {their} choices never depend on fees.', 'I am home for dinner and bedtime, not stuck on late-night calls.', '{They} grow{s} up watching me set a hard goal and reach it, one day at a time.', 'Holidays where {they} see{s} new places, not just pictures of them.'];
      if (['parents', 'mother', 'father'].includes(r)) return ['{Their} health care and comfort are never a question of money.', 'I take {them} on the trip {they} always talked about.', '{They} see{s} the years {they} put into me pay off.', 'More time with {them}, without the month-end worry.'];
      if (['wife', 'husband', 'partner'].includes(r)) return ['Freedom for {them} to pursue what {they} want{s}, with no money worry behind it.', 'More evenings and weekends together.', 'A home we choose together.', '{They} see{s} me keep the promise I made.'];
      return ['{They} never ha{s} to worry about me.', 'More time together, less month-end worry.', 'I show up for {them} the way {they} showed up for me.'];
    }
    if (key === 'family') return ['A safety cushion: insurance, savings and no month-end worry.', 'More evenings and weekends that belong to us.', 'A home we choose, not one we settle for.'];
    return ['Designing data platforms used by millions, with engineers who raise my bar.', 'A staff role where I set technical direction, not just deliver tickets.', 'Learning is part of the job, not squeezed in at midnight.', 'Proof to myself that a career in services can lead anywhere.'];
  }
  function phoneCard() {
    const n = her(); const N = n.charAt(0).toUpperCase() + n.slice(1); const pb = buildPlan(); const l = life();
    const weekly = pb.budget.weekday * 5 + pb.budget.sat + pb.budget.sun; const pct = Math.round(420 / weekly * 100);
    const sc = skipCostDays(); const age = herAgeAtOffer(); const sd = pb.weekday.find((b) => b.kind === 'sd');
    const lines = [
      '<li><b>One hour of reels a day is 7 hours a week.</b> That is ' + pct + '% of your whole weekly prep plan (' + fmtH(weekly) + '), gone into someone else’s feed.</li>',
      sc >= 0 ? '<li><b>Skipping one day</b> pushes your finish about ' + halves(sc) + (sc <= 1 ? ' day' : ' days') + ' later, at your current pace.</li>' : '',
      '<li><b>Sleep by ' + ampm(toMin(l.sleep, 30)) + '.</b> Your ' + (sd ? ampm(sd.s) : 'morning') + ' deep work is your sharpest hour only if the night before was sleep, not scrolling.</li>',
      age ? '<li><b>' + esc(N) + ' will be about ' + age + '</b> when you start the new job. ' + personal('These are the months that decide which life {they} grow{s} up in.') + '</li>' : '',
      S.profile.targetDate ? '<li><b>' + Math.max(0, daysBetween(today(), S.profile.targetDate)) + ' days</b> to your offer date. Each one is either prep or a day you will have to make up.</li>' : ''
    ].filter(Boolean).join('');
    return '<section class="phonecard"><h2>Before you pick up your phone</h2><ul>' + lines + '</ul><p class="phone-rule">The rule: <b>timer first, feed never</b> until the day is complete. Charge the phone outside the bedroom.</p></section>';
  }
  function renderWhyView() {
    const p = S.profile; const n = isSelf() ? 'myself' : who();
    const left = p.targetDate ? daysBetween(today(), p.targetDate) : null;
    const list = (arr) => '<ul>' + arr.filter(Boolean).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    document.getElementById('whyview').innerHTML =
      '<h1>' + (p.why ? esc(p.why) : 'Why I am doing this') + '</h1>' +
      '<p class="lede">' + esc(p.role) + ' at ' + esc(p.companies) + (p.targetDate ? '. Offer by ' + esc(niceDate(p.targetDate)) + (left !== null && left >= 0 ? ', ' + left + ' days from now' : '') : '') + '.</p>' +
      '<div class="vision">' + (isSelf() ? '' : '<section><h2>For ' + esc(n) + '</h2>' + list(visionFor('them').map(personal)) + '</section>') + '<section><h2>For our family</h2>' + list(visionFor('family').map(personal)) + '</section><section><h2>For me</h2>' + list(visionFor('me').map(personal)) + '</section></div>' +
      (p.letter ? '<section class="letter"><h2>A letter to ' + esc(isSelf() ? 'yourself' : n) + ', to read on offer day</h2><p>' + esc(p.letter).replace(/\n/g, '<br>') + '</p></section>' : '') +
      phoneCard() +
      '<p class="note">Read this when you feel like skipping. Then start the timer for ' + minNow() + ' minutes. That is all today needs.</p>';
  }
  function initWhy() {
    const f = document.getElementById('whyform'); const p = S.profile;
    ['me', 'years', 'why', 'role', 'companies', 'targetDate', 'hoursGoal', 'letter'].forEach((k) => { f.elements[k].value = p[k] || ''; });
    ['them', 'family', 'me'].forEach((k) => { f.elements['v-' + k].value = visionFor(k).map(personal).join('\n'); });
    const m = motive(); f.elements.relation.value = m.relation || ''; f.elements.name.value = m.name || ''; f.elements.pronoun.value = m.pronoun || '';
    f.elements.herAge.value = m.age === undefined ? '' : m.age;
    f.onsubmit = (e) => {
      e.preventDefault();
      ['me', 'why', 'role', 'companies', 'targetDate', 'letter'].forEach((k) => { p[k] = f.elements[k].value.trim(); });
      p.hoursGoal = Math.max(10, parseInt(f.elements.hoursGoal.value, 10) || 250);
      p.years = f.elements.years.value.trim() === '' ? '' : Math.max(1, Math.min(45, parseInt(f.elements.years.value, 10) || 1));

      p.motive = Object.assign({}, motive(), { relation: f.elements.relation.value, name: f.elements.name.value.trim(), pronoun: f.elements.pronoun.value });
      const ag = f.elements.herAge.value.trim(); if (String(ag) !== String(motive().age)) { p.motive.age = ag === '' ? '' : Math.max(0, Math.min(25, +ag)); p.motive.ageAt = Date.now(); }
      ['them', 'family', 'me'].forEach((k) => { const lines = f.elements['v-' + k].value.split('\n').map((x) => x.trim()).filter(Boolean); if (lines.join('|') !== visionFor(k).map(personal).join('|')) p.vision[k] = lines; });
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
    const FOCUS = { either: 'Either', dsa: 'DSA', sd: 'System design', family: 'Family', sleep: 'Sleep', night: 'Phone down', late: 'Late check (silent)', gym: 'Gym' };
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
      if (S.reminders.length >= 16) { toast('Up to 16 reminders. Delete one first.'); return; }
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
        dbp.innerHTML = '<h2>Your data on this phone</h2><p>Everything (sessions, notes, statuses, retrospectives, stories, mocks, your plan, settings and the running timer) is saved in DataLeap’s own database on this phone the moment it changes. Nothing is kept in browser storage and nothing is uploaded anywhere.</p>' +
          '<ul class="nativestat"><li><span class="chip st-done">Saved</span> ' + (info.updated ? 'Last saved ' + new Date(info.updated).toLocaleString() : 'Not saved yet') + (info.bytes ? ', ' + Math.max(1, Math.round(info.bytes / 1024)) + ' KB' : '') + '</li>' +
          '<li><span class="chip">' + snaps.length + '</span> daily snapshots kept (last 30 days)</li></ul>' +
          (snaps.length ? '<div class="row"><div class="field"><label for="snap">Restore a day</label><select id="snap">' + snaps.map((x) => '<option value="' + x.day + '">' + esc(niceDate(x.day)) + '</option>').join('') + '</select></div><div class="field" style="flex:0 0 auto"><button class="btn" id="snapgo" type="button">Restore</button></div></div>' : '') +
          '<p class="actions"><button class="btn primary" type="button" data-export-ai>Export for AI analysis (CSV)</button></p>' +
          '<p class="small muted">Uninstalling the app deletes this database. Before changing phones, use Progress → Export backup.</p>';
        const go = document.getElementById('snapgo');
        if (go) go.onclick = () => {
          const day = document.getElementById('snap').value;
          if (!confirm('Replace your current data with the snapshot from ' + niceDate(day) + '? Anything after that is lost.')) return;
          try { const raw = BR.dbSnapshot(day); const d = JSON.parse(raw); if (!d.sessions) throw 0; d.updatedAt = Date.now(); S = load(JSON.stringify(d)); save(); toast('Restored ' + niceDate(day)); setTimeout(() => location.reload(), 600); } catch (e) { toast('That snapshot could not be read.'); }
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
    document.getElementById('reset').onclick = () => { if (confirm('Delete all progress, notes and settings' + (BR ? ' from the phone database' : ' in this browser') + '? Export a backup first if you need it.')) { if (BR && BR.dbReset) BR.dbReset(); else { localStorage.removeItem(KEY); localStorage.removeItem(TKEY); } location.reload(); } };
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
    { id: 'h100', g: 'Hours', icon: '🔥', t: '100 hours', d: '100 hours of focused prep', ok: (c) => c.hours >= 100, msg: 'A hundred hours. This is what serious looks like, and you did not quit.' },
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
    { id: 'loop1', g: 'Career', icon: '🚪', t: 'In the loop', d: 'Reached interviews at a company', ok: (c) => c.loops >= 1, msg: 'You are in a product-company interview loop. A year ago this was a plan; now it is a calendar invite.' },
    { id: 'offer1', g: 'Career', icon: '🎉', t: 'The offer', d: 'Received an offer', ok: (c) => c.offers >= 1, msg: 'An offer. Every early morning and every skipped scroll led here. Now choose well.' },
    { id: 'fit1', g: 'Fitness', icon: '💪', t: 'First workout', d: 'Logged your first workout', ok: (c) => c.workouts >= 1, msg: 'First session done. Two goals, one morning routine: this is how both get won.' },
    { id: 'fit4', g: 'Fitness', icon: '🏋️', t: 'Full gym week', d: 'Every planned workout in one week', ok: (c) => c.bestGymWeek >= c.gymTarget, msg: 'Every workout this week. Consistency in the gym and at the desk come from the same place.' },
    { id: 'fit25', g: 'Fitness', icon: '🏋️', t: '25 workouts', d: '25 workouts logged', ok: (c) => c.workouts >= 25, msg: 'Twenty-five sessions. Your body is changing even before the scale says so.' },
    { id: 'kg2', g: 'Fitness', icon: '📉', t: '2 kg down', d: '2 kg below your start', ok: (c) => c.lost >= 2, msg: 'Two kilos down. Keep the protein high and the post-office snacks low.' },
    { id: 'kg5', g: 'Fitness', icon: '📉', t: '5 kg down', d: '5 kg below your start', ok: (c) => c.lost >= 5, msg: 'Five kilos. People will start noticing before you do.' },
    { id: 'kggoal', g: 'Fitness', icon: '🏆', t: 'Goal weight', d: 'Reached your goal weight', ok: (c) => c.atGoal, msg: 'Goal weight. Now keep the strength and stamina: the next goal is the offer.' },
    { id: 'food7', g: 'Fitness', icon: '🥗', t: 'Food diary week', d: '7 days with 3+ food entries', ok: (c) => c.foodDays >= 7, msg: 'A full week written down. Now you know what you actually eat, which is where every good change starts.' },
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
      foodDays: (() => { const m = {}; (S.meals || []).forEach((x) => { m[x.date] = (m[x.date] || 0) + 1; }); return Object.values(m).filter((n) => n >= 3).length; })(),
      workouts: (S.workouts || []).filter((w) => w.minutes >= 20).length, gymTarget: fit().gymDays.length || 99,
      bestGymWeek: (() => { const m = {}; (S.workouts || []).filter((w) => w.minutes >= 20).forEach((w) => { const k = weekStart(w.date); m[k] = (m[k] || 0) + 1; }); return Math.max(0, ...Object.values(m)); })(),
      lost: (S.weights || []).length ? fit().startKg - weightNow() : 0, atGoal: (S.weights || []).length > 0 && weightNow() <= fit().goalKg,
      stories: (S.stories || []).filter((x) => storyStrength(x) >= 80).length, loops: (S.apps || []).filter((a) => ['loop', 'offer'].includes(a.stage)).length, offers: (S.apps || []).filter((a) => a.stage === 'offer').length, mocks: (S.mocks || []).length, strongHire: (S.mocks || []).some((m) => m.score === 4)
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
  function persona(t) { return personal(t.replace(/\{her\}/g, '{Name}')); }
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

  // ---------- the honest cost of skipping, and her age when you start ----------
  function skipCostDays() {
    if (!S.sessions.length) return -1;
    const t = today(); const span = Math.min(28, daysBetween(firstDay(), t) + 1);
    let mins = 0; S.sessions.forEach((x) => { if (x.date > addDays(t, -span) && x.date <= t) mins += x.minutes; });
    const avg = mins / span; const tg = targets(t);
    return avg > 0 ? (tg.sd + tg.dsa) / avg : 1;
  }
  const halves = (v) => { const r = Math.max(0.5, Math.round(v * 2) / 2); const w = Math.floor(r); return (r === w ? String(w) : (w ? w : '') + '½'); };
  function herAgeAtOffer() {
    const p = S.profile; const mv = motive();
    if (!isChild() || !p.targetDate || mv.age === '' || mv.age === null || mv.age === undefined || isNaN(+mv.age)) return '';
    const asOf = mv.ageAt || Date.now(); const [y, m, d] = p.targetDate.split('-').map(Number);
    return halves(+mv.age + (new Date(y, m - 1, d) - asOf) / (365.25 * 864e5));
  }

  // ---------- career mentor: the day plan ----------
  const toMin = (hhmm, def) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m ? (+m[1]) * 60 + (+m[2]) : def; };
  const toHM = (m) => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const ampm = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + (mm ? ':' + pad(mm) : '') + (h < 12 ? ' am' : ' pm'); };
  function life() {
    const l = Object.assign({ officeStart: '09:30', officeEnd: '18:30', commute: 30, wake: '06:30', sleep: '23:00', workDays: [1, 2, 3, 4, 5] }, S.profile.life || {});
    if (!Array.isArray(l.workDays) || !l.workDays.length) l.workDays = [1, 2, 3, 4, 5];
    return l;
  }
  /**
   * The day plan, for any shift. Minutes from midnight (values past 1440 run into the next day).
   * Late shifts (3+ free hours before office): family first, deep work, DSA, then family again before office.
   * Day shifts: deep work early, family in the evening, then DSA and revision before sleep.
   */
  function buildPlan() {
    const l = life(); const self = isSelf();
    const W = toMin(l.wake, 390); const O = toMin(l.officeStart, 570); let E = toMin(l.officeEnd, 1110); if (E <= O) E += 1440;
    let SL = toMin(l.sleep, 1380); if (SL <= W) SL += 1440;
    const C = Math.max(0, +l.commute || 0); const leave = O - C, ready = leave - 30, back = E + C;
    const famT = (title, selfTitle) => (self ? selfTitle : personal(title));
    const b = []; const add = (s, e, kind, title, why) => { if (e - s >= 5) b.push({ s, e, kind, title, why }); };
    let mode;
    if (ready - W >= 210) {
      mode = 'late';
      const lunch = ready - 75; let t = W;
      const fo = fit().on; const gymLen = fo ? fit().gymMin : 30; const famLen = fo ? 60 : 75;
      add(t, t + famLen, 'family', famT('Morning with {name}', 'Slow start'), self ? 'No phone for the first 30 minutes: water, a walk, a plan for the day.' : personal('{Name} first. On office days this is your best time together. Phone stays away.')); t += famLen;
      const sdLen = Math.max(30, Math.min(75, lunch - t - (fo ? 105 + gymLen : 150)));
      add(t, t + sdLen, 'sd', 'Deep work: system design', 'Your sharpest hour goes to the round that decides staff offers. Today’s item is ready on the Today screen.'); t += sdLen;
      add(t, t + 10, 'break', 'Break', 'Water, stretch.'); t += 10;
      add(t, t + 30, 'dsa', 'DSA: one question', 'One data-engineering question, 25 minutes, out loud.'); t += 30;
      add(t, t + gymLen, 'health', fo ? 'Gym' : 'Walk or exercise', fo ? 'Your second goal. Strength and stamina make the long shift and the deep work easier.' : 'A long shift needs a body that can carry it.'); t += gymLen;
      add(t, lunch, 'family', famT('Time with {name}', 'Personal time'), self ? 'Read, call a friend, rest. Recovery makes the deep work stick.' : personal('Be fully present. This is the time {they} will remember.'));
      add(lunch, ready - 15, 'family', self ? 'Lunch' : 'Lunch together', 'Eat properly, then get ready.');
      add(ready - 15, ready, 'rev', 'Revision: pinned notes', '15 minutes reading your key notes. Easy, and it compounds.');
      add(ready, leave, 'life', 'Get ready', '');
      add(leave, O, 'life', 'Commute', 'Audio only: a system design video or podcast if you like.');
      add(O, E, 'office', 'Office', 'Do your job well. It pays for everything else, and your next manager will ask about it.');
      add(back, back + 20, 'wind', 'Wind down', 'Only if today is incomplete: the 10-minute version. Then log and close the laptop.');
      add(back + 20, SL, 'life', 'Dinner, unwind', 'No studying after a full shift. Tired study builds nothing.');
    } else {
      mode = 'day';
      let t = W;
      add(t, t + 15, 'life', 'Wake up, no phone', 'Water and daylight before any screen.'); t += 15;
      const sdLen = Math.max(0, Math.min(60, ready - t - 20));
      if (sdLen >= 20) { add(t, t + sdLen, 'sd', 'Deep work: system design', 'Before the day takes over: your sharpest, quietest time goes to system design.'); t += sdLen; }
      add(t, ready, 'family', famT('Breakfast with {name}', 'Breakfast'), self ? 'Eat properly. The day is long.' : 'Phones away at the table.');
      add(ready, leave, 'life', 'Get ready', '');
      add(leave, O, 'life', 'Commute', 'Audio only: revise your pinned notes or a system design podcast.');
      add(O, E, 'office', 'Office', 'Do your job well. It pays for everything else, and your next manager will ask about it.');
      if (back > E) add(E, back, 'life', 'Commute home', 'No study on the road. Call home, decompress.');
      const eveEnd = SL - 40; let t2 = back;
      if (fit().on) { add(t2, t2 + fit().gymMin, 'health', 'Gym', 'Straight from work, before the sofa wins.'); t2 += fit().gymMin; }
      const needStudy = (sdLen >= 20 ? 0 : 45) + 30 + 15;
      const famLen = Math.max(45, Math.min(120, eveEnd - t2 - needStudy - 40));
      add(t2, t2 + famLen, 'family', famT('Time with {name}', 'Personal time'), self ? 'Walk, cook, rest. Recharge before the evening block.' : personal('Laptop closed. {Name} first; this is your time together.')); t2 += famLen;
      add(t2, t2 + 40, 'family', self ? 'Dinner' : 'Dinner together', ''); t2 += 40;
      if (sdLen < 20) { add(t2, t2 + 45, 'sd', 'Deep work: system design', 'Your one quiet block today. Phone in another room.'); t2 += 45; }
      add(t2, t2 + 30, 'dsa', 'DSA: one question', 'One data-engineering question, 25 minutes, out loud.'); t2 += 30;
      add(t2, t2 + 15, 'rev', 'Revision: pinned notes', '15 minutes on your key notes, then stop.'); t2 += 15;
      add(Math.max(t2, SL - 40), SL - 20, 'wind', 'Wind down', 'Only if today is incomplete: the 10-minute version. Then phone away.');
      add(Math.max(t2, SL - 20), SL, 'life', 'Screens off', 'Charge the phone outside the bedroom.');
    }
    add(SL, W + 1440, 'sleep', 'Sleep', 'Seven hours. Tomorrow’s deep work depends on tonight’s sleep.');
    const sw = W + 30; const sat = []; const addS = (s, e, kind, title, why) => sat.push({ s, e, kind, title, why });
    addS(sw, sw + 90, 'family', self ? 'Slow morning' : famT('Slow morning with {name}', ''), 'No alarms beyond this one. Breakfast without screens.');
    addS(sw + 90, sw + 180, 'sd', 'Full design case or mock interview', '90 minutes, timed, scored with the staff rubric. This is where offers are won.');
    addS(sw + 180, sw + 195, 'break', 'Break', '');
    addS(sw + 195, sw + 240, 'dsa', 'Two DSA questions', 'Interview conditions: 25 minutes each.');
    if (fit().on) addS(sw + 240, sw + 240 + fit().gymMin, 'health', 'Gym', 'Weekend session, then the day is free.');
    const satFree = sw + 240 + (fit().on ? fit().gymMin : 0);
    addS(satFree, sw + 600, 'family', self ? 'Your afternoon' : 'Family afternoon', self ? 'Go outside, see people. The work is done.' : 'Outings, visits, play. Fully present: the work is done.');
    const sun = [
      { s: sw, e: sw + 600, kind: 'family', title: self ? 'Rest day' : 'Family day', why: 'Rest is part of the plan. Use your rest day if you want the whole day.' },
      { s: 1080, e: 1110, kind: 'rev', title: 'Weekly retrospective + revision', why: 'Three questions about the week, then 20 minutes of pinned notes.' }
    ];
    const sum = (k) => b.filter((x) => x.kind === k).reduce((a, x) => a + x.e - x.s, 0);
    return { weekday: b, sat, sun, l, mode, back, budget: { weekday: sum('sd') + sum('dsa') + sum('rev'), sat: 135, sun: 20 } };
  }
  /** Reminders that follow the plan (max 12). Office days come from your settings. */
  function planReminders(p) {
    const wk = p.l.workDays; const all = [0, 1, 2, 3, 4, 5, 6]; const off = all.filter((d) => !wk.includes(d));
    const find = (k, list) => (list || p.weekday).find((x) => x.kind === k);
    const fam = find('family'), sd = find('sd'), dsa = find('dsa'), rev = find('rev'), wind = find('wind'), sleep = find('sleep');
    const together = p.weekday.find((x) => x.kind === 'family' && /^(Time with|Personal time)/.test(x.title));
    const satSd = find('sd', p.sat), satDsa = find('dsa', p.sat), sunRev = find('rev', p.sun);
    const r = (id, m, days, focus, msg, extra) => ({ id, time: toHM(m), days, focus, msg, skip: true, last: false, on: true, ...(extra || {}) });
    const nightAt = p.back + 5; // as you get home
    const lastOk = wind && sleep && (p.mode === 'day' || sleep.s - p.back >= 45);
    const out = [
      fam && r('p-fam', p.mode === 'late' ? fam.s + 5 : p.weekday[0].s + 5, all, 'family', isSelf() ? 'Good morning: no phone for the first 30 minutes.' : 'Morning: phone down. ' + Cap(who()) + ' first.'),
      sd && r('p-sd', sd.s - 5, wk, 'sd', 'Deep work in 5 minutes: system design.'),
      dsa && r('p-dsa', dsa.s, wk, 'dsa', 'DSA: one question, 25 minutes, out loud.'),
      together && r('p-kid', together.s, wk, 'family', isSelf() ? 'Laptop closed. Personal time.' : 'Laptop closed. Time with ' + who() + '.'),
      rev && r('p-rev', rev.s, wk, 'either', '15-minute revision of your pinned notes.'),
      lastOk && r('p-last', p.mode === 'late' ? p.back + 15 : wind.s + 5, wk, 'either', 'Only if today is incomplete: the 10-minute version, then rest.', { last: true }),
      r('p-night', nightAt, wk, 'night', 'Office is over. Phone down.'),
      sleep && r('p-sleep', sleep.s - 15, all, 'sleep', 'Wind down in 15 minutes. Sleep by ' + ampm(sleep.s) + '.'),
      sleep && r('p-late', sleep.s + 20, all, 'late', 'Silent check if you are still on your phone after bedtime.'),
      off.length && r('p-sat', satSd.s - 5, off.length === 1 ? off : off.filter((d) => d !== 0), 'sd', 'Day off deep work: one full design case or a mock interview.'),
      off.length && r('p-satdsa', satDsa.s, off.length === 1 ? off : off.filter((d) => d !== 0), 'dsa', 'Two DSA questions under interview conditions.'),
      r('p-sun', sunRev.s, off.length === 1 ? off : [0], 'either', 'Weekly retrospective and 20 minutes of revision.'),
      ...(fit().on ? (() => { const g = find('health'); const gs = find('health', p.sat); const gd = fit().gymDays;
        return [g && r('p-gym', g.s - 15, wk.filter((x) => gd.includes(x)), 'gym', 'Gym in 15 minutes.'),
          gs && off.filter((x) => gd.includes(x)).length && r('p-satgym', gs.s - 15, off.filter((x) => gd.includes(x)), 'gym', 'Weekend gym in 15 minutes.')]; })() : [])
    ].filter(Boolean);
    return out.slice(0, 16);
  }
  function applyPlan(silent) {
    const p = buildPlan();
    S.reminders = planReminders(p);
    const firstStudy = p.weekday.find((x) => x.kind === 'sd') || p.weekday[0];
    const wake = toMin(p.l.wake, 390); const endWin = p.mode === 'late' ? toMin(p.l.officeStart, 570) - 30 : Math.max(wake + 120, firstStudy.e + 120);
    S.settings.motiv = Object.assign({}, S.settings.motiv, { start: toHM(wake + 20), end: toHM(Math.min(endWin, wake + 480)) });
    S.settings.restPerWeek = Math.max(1, S.settings.restPerWeek);
    S.planApplied = Date.now(); S.planVersion = 4; save(); syncNative();
    if (!silent) { const sd = p.weekday.find((x) => x.kind === 'sd'); const sl = p.weekday.find((x) => x.kind === 'sleep'); showCoachCard('Done. Your reminders now follow your day: deep work at ' + (sd ? ampm(sd.s) : 'your study time') + ', ' + (isSelf() ? 'personal time protected' : 'time with ' + who() + ' protected') + ', nothing heavy after office, sleep by ' + (sl ? ampm(sl.s) : 'your bedtime') + '.'); }
  }
  function blocksFor(date) {
    const p = buildPlan(); const d = dow(date);
    const relabel = (list) => list.map((b) => (b.kind === 'health' && fit().on && !isGymDay(date) ? Object.assign({}, b, { title: 'Walk and mobility', why: 'Rest day from the gym: an easy walk keeps you moving. Take the family along.' }) : b));
    if (p.l.workDays.includes(d)) return relabel(p.weekday);
    const off = [0, 1, 2, 3, 4, 5, 6].filter((x) => !p.l.workDays.includes(x));
    if (off.length === 1) return relabel(p.sat.concat(p.sun.filter((x) => x.kind === 'rev')));
    return relabel(d === 0 ? p.sun : p.sat);
  }
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
    if (cur.kind === 'family') return (isSelf() ? 'Personal time. Rest counts too; the laptop can wait' : 'Family time. ' + Cap(who()) + ' first; the laptop can wait') + (next && (next.kind === 'sd' || next.kind === 'dsa') ? ' until ' + ampm(next.s) + '.' : '.');
    if (cur.kind === 'sleep' || cur.kind === 'life' && new Date().getHours() < 5) return 'It’s late. Sleep is part of the plan. Tomorrow’s deep work needs it.';
    if (cur.kind === 'health' && fit().on) return gymDone(today()) ? 'Workout done. Now go be with ' + (isSelf() ? 'yourself' : who()) + '.' : (isGymDay(today()) ? 'Gym time: ' + workoutFor(today()).name + '. Your second goal matters as much as the first.' : 'Easy walk today. Take the family along.');
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
      { id: 'c-offer', from: T, to: null, title: 'Offer, negotiate, notice period', d: 'Compare offers on total compensation. Notice periods in India are often 60 to 90 days: plan the joining date with the people it affects.' }
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
    const lede = document.getElementById('plan-lede');
    if (lede) {
      const shift = ampm(toMin(l.officeStart, 570)) + ' to ' + ampm(toMin(l.officeEnd, 1110));
      lede.innerHTML = 'You work <b>' + shift + '</b>. ' + (p.mode === 'late'
        ? 'Your mornings are free and your mind is sharpest then, so this plan gives the morning to ' + esc(isSelf() ? 'your own start' : who()) + ' first, the next hours to deep work, keeps nothing heavy after office, and protects your sleep.'
        : 'Your quietest time is early morning, so deep work happens before office, evenings belong to ' + esc(isSelf() ? 'you' : who()) + ' first, DSA comes after dinner, and sleep is protected.') + ' Your reminders follow this plan.';
    }
    const f = document.getElementById('lifeform');
    if (f && !f.dataset.ready) {
      ['officeStart', 'officeEnd', 'wake', 'sleep'].forEach((k) => { f.elements[k].value = l[k]; });
      f.elements.commute.value = l.commute;
      f.querySelectorAll('input[name=wd]').forEach((c) => { c.checked = l.workDays.includes(+c.value); });
      f.dataset.ready = '1';
      f.onsubmit = (e) => {
        e.preventDefault();
        const wd = [...f.querySelectorAll('input[name=wd]:checked')].map((c) => +c.value);
        S.profile.life = { officeStart: f.elements.officeStart.value || '09:30', officeEnd: f.elements.officeEnd.value || '18:30', commute: Math.max(0, Math.min(180, +f.elements.commute.value || 0)), wake: f.elements.wake.value || '06:30', sleep: f.elements.sleep.value || '23:00', workDays: wd.length ? wd : [1, 2, 3, 4, 5] };
        applyPlan(false); renderPlan();
      };
    }
    const tl = (blocks) => '<ol class="tline">' + blocks.map((b) => '<li class="k-' + b.kind + '"><span class="tl-t">' + ampm(b.s) + '</span><div><b>' + esc(b.title) + '</b><span class="tl-d">' + dur(b) + '</span>' + (b.why ? '<p>' + esc(b.why) + '</p>' : '') + '</div></li>').join('') + '</ol>';
    document.getElementById('weekday').innerHTML = tl(p.weekday);
    const offDays = [0, 1, 2, 3, 4, 5, 6].filter((x) => !l.workDays.includes(x)); const DN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('weekend').innerHTML = offDays.length === 1
      ? '<h3>' + DN[offDays[0]] + ', your one day off</h3>' + tl(p.sat.concat(p.sun.filter((x) => x.kind === 'rev')).sort((a, b) => a.s - b.s))
      : offDays.length ? '<h3>Saturday and other days off</h3>' + tl(p.sat) + '<h3 style="margin-top:18px">Sunday</h3>' + tl(p.sun) : '<p class="muted">No days off set. Everyone needs at least one: add it under Office days.</p>';
    const wkh = document.querySelector('#weekend'); if (wkh && wkh.previousElementSibling) { const h = wkh.parentElement.querySelector('.sec-head h2'); if (h) h.textContent = offDays.length === 1 ? 'Your day off' : 'Days off'; }
    const wdh = document.querySelector('#weekday'); if (wdh) { const sub = wdh.parentElement.querySelector('.sec-head p'); if (sub) sub.textContent = l.workDays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => DN[x].slice(0, 3)).join(', '); }
    const wkMin = p.budget.weekday * 5 + p.budget.sat + p.budget.sun;
    const famMin = p.weekday.filter((b) => b.kind === 'family').reduce((a, b) => a + b.e - b.s, 0);
    const famLabel = isSelf() ? 'of personal time every office day' : 'with ' + who() + ' every office day';
    document.getElementById('budget').innerHTML = '<div class="bud"><b>' + fmtH(wkMin) + '</b><span>prep a week at full pace</span></div><div class="bud"><b>' + fmtH(famMin) + '</b><span>' + esc(famLabel) + '</span></div><div class="bud"><b>' + fmtH(((toMin(l.wake, 450) + 1440 - toMin(l.sleep, 30)) % 1440)) + '</b><span>sleep a night</span></div>';
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
    return 'DataLeap weekly check-in' + (me() ? ', ' + me() : '') + '\n' +
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
    const apb = document.getElementById('apps'); if (apb) apb.innerHTML = appsBoard();
    const cm = document.getElementById('commit');
    if (cm) {
      const def = 'For the next 12 months I will put about ' + (S.profile.weeklyHours || 8) + ' hours a week into preparation, ' + (isSelf() ? 'protect my health' : 'protect my time with ' + her()) + ', keep my sleep, and start applying by ' + (pace().applyBy ? niceDate(pace().applyBy) : 'my apply date') + '. I will not quit on a bad week.';
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

  // ---------- export for analysis: CSV files + a guide for Claude ----------
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function csv(header, rows) {
    const cell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '\uFEFF' + [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
  }
  const iso = (ts) => { if (!ts) return ''; const d = new Date(ts); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const trackName = (t) => ({ sd: 'system_design', dsa: 'dsa', sql: 'sql' }[t] || t);
  function blockAt(ts) {
    try {
      const d = new Date(ts); const m = d.getHours() * 60 + d.getMinutes(); const bl = blocksFor(ymd(d));
      for (const b of bl) { const mm = m < b.s && b.e > 1440 && m < 360 ? m + 1440 : m; if (mm >= b.s && mm < b.e) return b.title; }
    } catch (e) {}
    return '';
  }
  function buildExport() {
    const files = []; const add = (name, content, mime) => files.push({ name, mime: mime || 'text/csv', content });
    const first = S.sessions.length ? firstDay() : today();

    // 1. sessions: every logged session
    add('sessions.csv', csv(
      ['session_id', 'study_date', 'weekday', 'logged_at', 'hour', 'track', 'minutes', 'min_to_count', 'counted', 'activity', 'item_id', 'item_title', 'topic_code', 'topic_name', 'item_type', 'difficulty', 'design_part', 'source', 'plan_block_at_that_time'],
      S.sessions.slice().sort((a, b) => a.at - b.at).map((x) => {
        const it = byId[x.itemId]; const tp = it ? topicBy[it.topic] : null; const min = x.min || 10;
        return [x.id, x.date, WD[dow(x.date)], iso(x.at), new Date(x.at).getHours(), trackName(x.track), x.minutes, min, x.minutes >= min ? 'yes' : 'no',
          x.activity || '', x.itemId || '', it ? it.title : '', it ? it.topic : '', tp ? tp.name : '', it ? it.type : '', it ? (it.diff || '') : '', x.part || '', x.source || '', blockAt(x.at)];
      })));

    // 2. daily: one row per day since you started, with a running streak
    const days = []; let run = 0;
    for (let d = first; d <= today(); d = addDays(d, 1)) {
      const i = dayInfo(d); const tg = targets(d); const n = S.sessions.filter((x) => x.date === d).length;
      if (i.status === 'ok') run++; else if (i.status !== 'rest' && d !== today()) run = 0;
      days.push([d, WD[dow(d)], i.sd, i.dsa, i.sd + i.dsa, tg.sd, tg.dsa, { ok: 'complete', part: 'partial', miss: 'missed', rest: 'rest' }[i.status] || i.status, n, run]);
    }
    add('daily.csv', csv(['date', 'weekday', 'system_design_min', 'dsa_min', 'total_min', 'system_design_target_min', 'dsa_target_min', 'day_status', 'sessions', 'streak_after_day'], days));

    // 3. weekly, joined with that week's retrospective
    const weeks = [];
    for (let w = weekStart(first); w <= today(); w = addDays(w, 7)) {
      const x = weekStats(w); const r = retroFor(w) || {};
      weeks.push([w, x.min, x.sd, x.dsa, x.complete, x.active, x.best && (x.best.sd + x.best.dsa) ? x.best.date : '', r.mood || '', r.well || '', r.blockers || '', r.change || '']);
    }
    add('weekly.csv', csv(['week_start', 'total_min', 'system_design_min', 'dsa_min', 'complete_days', 'active_days', 'best_day', 'retro_mood_1to5', 'retro_went_well', 'retro_got_in_the_way', 'retro_change_for_next_week'], weeks));

    // 4. items: status of every question, topic and lesson you have touched
    const touched = D.items.filter((i) => S.items[i.id] || minutesFor(i.id) > 0);
    add('items.csv', csv(
      ['item_id', 'track', 'topic_code', 'topic_name', 'title', 'type', 'difficulty', 'course_priority', 'status', 'next_review', 'times_solved_alone', 'total_min', 'sessions', 'notes', 'last_rubric_score_of_14', 'best_rubric_score_of_14', 'from_your_experience', 'link'],
      touched.map((i) => {
        const s = st(i.id); const sc = s.scores || []; const ex = typeof expFor === 'function' ? expFor(i.id) : null;
        return [i.id, trackName(i.track), i.topic, (topicBy[i.topic] || {}).name || '', i.title, i.type, i.diff || '', i.tier || '', STATUS_LABEL[s.status] || s.status, s.next || '', s.solvedCount || 0,
          minutesFor(i.id), S.sessions.filter((x) => x.itemId === i.id).length, (s.notes || []).length, sc.length ? sc[sc.length - 1].total : '', sc.length ? Math.max(...sc.map((x) => x.total)) : '', ex ? ex.from : '', i.links[0] ? i.links[0].url : ''];
      })));

    // 5. notes
    const notes = [];
    Object.keys(S.items).forEach((id) => { const s = S.items[id]; (s.notes || []).forEach((n) => notes.push([iso(n.at), id, (byId[id] || {}).title || '', (byId[id] || {}).topic || '', n.type, n.id === s.pinned ? 'yes' : 'no', n.body])); });
    notes.sort((a, b) => (a[0] > b[0] ? 1 : -1));
    add('notes.csv', csv(['created', 'item_id', 'item_title', 'topic_code', 'note_type', 'pinned_key_note', 'text'], notes));

    // 6. rubric scores for design cases
    const scores = [];
    D.items.forEach((i) => (st(i.id).scores || []).forEach((x) => scores.push([iso(x.at), i.id, i.title, x.total].concat(x.vals || []))));
    add('design_scores.csv', csv(['scored_at', 'item_id', 'case', 'total_of_14'].concat(D.rubric.map((r, k) => 'c' + (k + 1) + '_' + r.split(':')[0].toLowerCase().replace(/[^a-z]+/g, '_').replace(/_$/, ''))), scores));

    // 7. retrospectives
    add('retrospectives.csv', csv(['week_start', 'saved_at', 'mood_1to5', 'practice_min', 'complete_days', 'went_well', 'got_in_the_way', 'change_for_next_week'],
      (S.retros || []).slice().sort((a, b) => (a.week > b.week ? 1 : -1)).map((r) => [r.week, iso(r.at), r.mood || '', r.min || 0, r.complete || 0, r.well || '', r.blockers || '', r.change || ''])));

    // 8. mock interviews
    add('mock_interviews.csv', csv(['date', 'round', 'with', 'verdict', 'verdict_score_1to4', 'went_well', 'fix_next'],
      (S.mocks || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1)).map((m) => [m.date, MOCK_TYPES[m.type] || m.type, m.with || '', MOCK_SCORES[m.score] || '', m.score || '', m.well || '', m.fix || ''])));

    // 9. story bank
    add('stories.csv', csv(['story_id', 'title', 'where', 'strength_pct', 'staff_signals', 'times_practised', 'last_updated'].concat(STORY_FIELDS.map((f) => f[0])),
      (S.stories || []).map((x) => [x.id, x.title, x.org || '', storyStrength(x), (x.tags || []).join('; '), (x.practiced || []).length, iso(x.updated)].concat(STORY_FIELDS.map((f) => x[f[0]] || '')))));

    // 10. milestones
    add('milestones.csv', csv(['milestone_id', 'group', 'title', 'description', 'unlocked_at'],
      ACH.map((a) => [a.id, a.g, a.t, a.d, S.ach && S.ach[a.id] ? iso(S.ach[a.id]) : ''])));

    // 11. applications
    add('applications.csv', csv(['company', 'role', 'level', 'stage', 'source', 'next_action', 'next_by', 'fixed_lakh', 'variable_lakh', 'stock_per_year_lakh', 'joining_bonus_lakh', 'first_year_total_lakh', 'notes', 'updated'],
      (S.apps || []).map((a) => [a.company, a.role, a.level, (APP_STAGES.find((x) => x[0] === a.stage) || [, a.stage])[1], a.source, a.next, a.nextAt, a.fixed, a.variable, a.stockYr, a.joining, firstYear(a) || '', a.notes, iso(a.updated)])));

    // 12. fitness
    add('workouts.csv', csv(['date', 'weekday', 'workout', 'minutes', 'note'], (S.workouts || []).slice().sort((a, b) => a.at - b.at).map((w) => [w.date, WD[dow(w.date)], w.name, w.minutes, w.note || ''])));
    add('weight.csv', csv(['date', 'kg', 'start_kg', 'goal_kg', 'goal_date'], (S.weights || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1)).map((w) => [w.date, w.kg, fit().startKg, fit().goalKg, fit().goalDate])));

    add('meals.csv', csv(['date', 'weekday', 'meal', 'label', 'time', 'after_office', 'what_and_how_much', 'protein_g', 'logged_at'],
      (S.meals || []).slice().sort((a, b) => (a.date === b.date ? mealMin(a) - mealMin(b) : a.date > b.date ? 1 : -1)).map((m) => [m.date, WD[dow(m.date)], slotName(m.slot), m.label || '', m.time || '', afterOffice(m) ? 'yes' : 'no', m.text, m.protein, iso(m.at)])));

    // 13. the guide for Claude
    add('README_for_Claude.md', analysisGuide(), 'text/markdown');
    return files;
  }
  function analysisGuide() {
    const r = readiness(); const pc = pace(); const p = S.profile; const c = S.coach;
    const lastWeeks = []; for (let k = 7; k >= 0; k--) { const w = weekStats(addDays(weekStart(today()), -7 * k)); lastWeeks.push('| ' + w.ws + ' | ' + (Math.round(w.min / 6) / 10) + ' | ' + (Math.round(w.sd / 6) / 10) + ' | ' + (Math.round(w.dsa / 6) / 10) + ' | ' + w.complete + '/7 |'); }
    return [
      '# DataLeap export for analysis',
      '',
      'Exported ' + iso(Date.now()) + '. I am ' + (me() || 'a data engineer') + ', with ' + (p.years ? p.years + ' years' : 'several years') + ' in software, preparing to move from a service company to a ' + (p.role || 'Staff Data Engineer') + ' role at ' + (p.companies || 'top product companies') + '.',
      p.targetDate ? 'Target offer date: ' + p.targetDate + '. Plan: ' + pc.goal + ' prep hours; done so far: ' + (Math.round(pc.doneH * 10) / 10) + ' h. Last-4-week average: ' + (Math.round(pc.avgWeekH * 10) / 10) + ' h a week; needed: ' + (Math.round((pc.needWeekH || 0) * 10) / 10) + ' h a week.' : '',
      'Office hours ' + life().officeStart + ' to ' + life().officeEnd + ' (' + (life().workDays || [1, 2, 3, 4, 5]).length + ' days a week). I study around my shift' + (isSelf() ? '.' : ' and protect time with ' + who() + '.') + (motive().relation ? ' I am doing this for ' + (isSelf() ? 'myself' : who()) + '.' : ''),
      'Interview readiness (DataLeap score): ' + r.score + '% (' + r.label + '). ' + r.parts.map((x) => x.label + ' ' + Math.round(x.v * 100) + '%').join('; ') + '.',
      c && c.gaps ? 'My known gaps, in priority order: ' + c.gaps.map((g) => g.title).join('; ') + '.' : '',
      '',
      '## Last 8 weeks (hours)',
      '',
      '| Week start | Total | System design | DSA | Complete days |',
      '| --- | --- | --- | --- | --- |',
      ...lastWeeks,
      '',
      '## Files',
      '',
      '- `sessions.csv`: every practice session. `counted` = it met the minimum for that day. `plan_block_at_that_time` = what my day plan had scheduled then (useful to check schedule adherence).',
      '- `daily.csv`: one row per day: minutes, targets, status (complete, partial, missed, rest) and running streak.',
      '- `weekly.csv`: one row per week, joined with that week\'s retrospective.',
      '- `items.csv`: every question, topic, lesson and design case I have touched, with status and time spent. `from_your_experience` marks design cases that match systems I built.',
      '- `notes.csv`: my notes on items (approach, mistakes, key insights).',
      '- `design_scores.csv`: staff-rubric scores (0 to 2 per criterion, 14 max) for full design attempts.',
      '- `retrospectives.csv`, `mock_interviews.csv`, `stories.csv` (project stories for deep-dive rounds), `milestones.csv`, `applications.csv`.',
      '- Fitness: `workouts.csv`, `weight.csv`, and `meals.csv` (every meal and drink with time and what I ate; `after_office` = eaten after my shift ended; eating after midnight counts toward the previous day).',
      (S.profile.fit ? 'Fitness goal: ' + fit().startKg + ' kg to ' + fit().goalKg + ' kg by ' + fit().goalDate + ', with strength and stamina; current ' + weightNow() + ' kg. I train ' + fit().gymDays.length + ' days a week.' : ''),
      '',
      '## What I want from you',
      '',
      'Act as a staff data engineer at a top product company coaching me. Be direct and specific; use numbers from the files.',
      '',
      '1. **Effort:** weekly trend, consistency (complete days), my most and least productive weekdays and hours, and whether I am on pace for my offer date.',
      '2. **Balance:** system design vs DSA share (target about 60/40), and which topics I avoid (little time, many not started).',
      '3. **Schedule:** how often I practise inside my planned blocks vs outside them, and what that says about my day plan.',
      '4. **Quality:** items I keep needing help with, rubric criteria I score lowest on, mock interview verdicts and the fixes I noted.',
      '5. **Retrospectives:** recurring blockers, whether I acted on the changes I committed to, and mood vs output.',
      '6. **Stories:** which project stories are weakest and what each needs before a deep-dive round.',
      '7. **Next 2 weeks:** a concrete plan (daily topics and minutes) that fixes the biggest gap without hurting family time or sleep.',
      '8. **Food and fitness:** from meals.csv estimate my daily calories and protein (give ranges, Indian portions), find patterns (late-night eating after office, skipped meals, sugar in chai, weekends), compare with my weight trend and workouts, and give me 5 specific swaps and a simple day of eating that fits my shift and a 0.4 to 0.6 kg a week loss.',
      ''
    ].filter((x) => x !== null).join('\n');
  }
  // Minimal ZIP writer (stored, no compression) for the website download
  function zipFiles(files) {
    const enc = new TextEncoder(); const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
    const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const parts = []; const central = []; let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255]; const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach((f) => {
      const name = enc.encode(f.name); const data = enc.encode(f.content); const crc = crc32(data);
      const head = [0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
      offset += head.length + name.length + data.length;
    });
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(offset), ...u16(0)]);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
  function exportForAnalysis() {
    const files = buildExport(); const stamp = today() + '-' + pad(new Date().getHours()) + pad(new Date().getMinutes());
    if (BR && BR.saveExport) {
      const n = BR.saveExport('export-' + stamp, JSON.stringify(files));
      if (n) showCoachCard(n + ' files saved to Downloads/DataLeap/export-' + stamp + '. Open the Claude app, attach them (start with README_for_Claude.md and sessions.csv), and ask for your coaching review.');
      else toast('Could not save the export.');
      return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(zipFiles(files)); a.download = 'dataleap-export-' + stamp + '.zip'; a.click();
    toast('Export downloaded: ' + files.length + ' files in one zip.');
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-export-ai]')) { e.preventDefault(); exportForAnalysis(); } });

  // ---------- bedtime screen: opened after bedtime? Go to sleep. ----------
  function bedtimeCheck() {
    if (!S.planApplied || sessionStorage.getItem('dl-bed-ok') === today()) return;
    const l = life(); const now = new Date(); let m = now.getHours() * 60 + now.getMinutes();
    let sl = toMin(l.sleep, 30); const wk = toMin(l.wake, 450);
    if (sl < 720) sl += 1440; if (m < 720) m += 1440;
    const end = Math.min(wk + 1440 - 120, 1440 + 300);
    if (m < sl || m > end) return;
    const n = her(); const N = n.charAt(0).toUpperCase() + n.slice(1); const pb = buildPlan(); const sd = pb.weekday.find((b) => b.kind === 'sd');
    const d = document.createElement('dialog'); d.className = 'award bedtime';
    d.innerHTML = '<div class="award-in"><p class="award-kicker">Past your bedtime</p><div class="award-badge" aria-hidden="true">🌙</div><h2>It’s ' + esc(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + (me() ? ', ' + esc(me()) : '') + '</h2>' +
      '<p class="award-msg"><span class="coach-av sm" aria-hidden="true">' + MARK + '</span><span>Nothing in this app is worth losing sleep over. ' + (isSelf() ? '' : esc(personal('{Name} need{s} you rested, and '))) + 'your ' + (sd ? ampm(sd.s) : 'morning') + ' deep work needs a clear head. ' + (dayInfo(today()).status === 'ok' ? 'Today is already complete.' : 'Whatever is left, tomorrow morning covers it.') + '</span></p>' +
      '<button class="btn haldi" type="button" id="bed-go">I’m going to sleep</button><button class="btn quiet" type="button" id="bed-two">Two minutes, then sleep</button></div>';
    document.body.appendChild(d); d.showModal();
    document.getElementById('bed-go').onclick = () => { sessionStorage.setItem('dl-bed-ok', today()); d.close(); if (BR && BR.closeApp) BR.closeApp(); else toast('Good night.'); };
    document.getElementById('bed-two').onclick = () => { sessionStorage.setItem('dl-bed-ok', today()); d.close(); };
  }

  // ---------- first-run setup: everything optional, everything editable later ----------
  const PRESETS = [
    { id: 'gen', label: '9:30 am – 6:30 pm', os: '09:30', oe: '18:30', wake: '06:30', sleep: '23:00' },
    { id: 'mid', label: '11 am – 8 pm', os: '11:00', oe: '20:00', wake: '07:00', sleep: '23:30' },
    { id: 'us', label: '2:30 pm – 11:30 pm', os: '14:30', oe: '23:30', wake: '07:30', sleep: '00:30' },
    { id: 'night', label: '9 pm – 6 am (night)', os: '21:00', oe: '06:00', wake: '14:00', sleep: '08:30' }
  ];
  const WHY_HINT = {
    daughter: 'So she grows up with every door open', son: 'So he grows up with every door open', children: 'So my children grow up with every door open',
    parents: 'So my parents never have to worry about anything again', mother: 'So my mother sees her sacrifices pay off', father: 'So my father sees his sacrifices pay off',
    wife: 'So we build the life we keep talking about', husband: 'So we build the life we keep talking about', partner: 'So we build the life we keep talking about',
    family: 'So my family never has to worry about money', myself: 'So I do work I am proud of, at the level I know I can reach', other: 'So the people I love never have to worry'
  };
  function initSetup() {
    const box = document.getElementById('setup'); if (!box) return;
    const p = S.profile; const l = life();
    const d = {
      me: p.me || '', years: p.years || '', companyType: p.companyType || 'service', role: p.role || 'Staff Data Engineer', companies: p.companies || '',
      targetDate: p.targetDate || addDays(today(), 300), relation: motive().relation || '', name: motive().name || '', age: motive().age === undefined ? '' : motive().age, pronoun: motive().pronoun || '',
      why: p.why || '', os: l.officeStart, oe: l.officeEnd, commute: l.commute, wake: l.wake, sleep: l.sleep, workDays: l.workDays.slice(),
      weekly: p.weeklyHours || 8, level: S.settings.level || 1, rest: S.settings.restPerWeek, motiv: S.settings.motiv.on ? S.settings.motiv.count : 0
    };
    let step = 0;
    const chip = (name, value, label, on) => '<label class="pick"><input type="radio" name="' + name + '" value="' + value + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
    const steps = [
      () => '<div class="st-hero"><p class="st-big">You already have the experience. DataLeap gives you the daily habit to show it in a product-company interview.</p>' +
        '<ul class="st-list"><li>System design first, data-engineering DSA second, starting at 10 minutes a day</li><li>A day plan and reminders built around <b>your</b> shift</li><li>A coach and notifications built around <b>your</b> reason for doing this</li><li>Everything stays on your phone</li></ul></div>',
      () => '<h2>About you</h2><div class="row"><div class="field"><label for="s-me">Your first name</label><input id="s-me" value="' + esc(d.me) + '" autocomplete="given-name"></div>' +
        '<div class="field"><label for="s-y">Years of experience</label><input id="s-y" type="number" min="1" max="45" value="' + esc(d.years) + '"></div></div>' +
        '<div class="field"><label>Where you work now</label><div class="picks">' + [['service', 'Service company'], ['product', 'Product company'], ['startup', 'Startup'], ['other', 'Other']].map(([v, t]) => chip('ct', v, t, d.companyType === v)).join('') + '</div></div>' +
        '<div class="row"><div class="field"><label for="s-role">Role you are aiming for</label><select id="s-role">' + ['Senior Data Engineer', 'Staff Data Engineer', 'Lead Data Engineer', 'Principal Data Engineer', 'Data Engineering Manager'].map((r) => '<option' + (r === d.role ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="s-co">Target companies (optional)</label><input id="s-co" value="' + esc(d.companies) + '" placeholder="e.g. Google, Uber, Databricks"></div>' +
        '<div class="field"><label for="s-td">Offer by</label><input id="s-td" type="date" value="' + esc(d.targetDate) + '"></div></div>',
      () => '<h2>Who are you doing this for?</h2><p class="muted">This is what your coach, quotes and reminders will come back to on hard days. Pick what is true for you.</p>' +
        '<div class="picks">' + Object.keys(REL).map((k) => chip('rel', k, REL[k].label, d.relation === k)).join('') + '</div>' +
        '<div class="row" id="s-who"><div class="field"><label for="s-nm">Their name(s), optional</label><input id="s-nm" value="' + esc(d.name) + '" placeholder="e.g. Riya, or Amma and Appa"></div>' +
        '<div class="field" id="s-agef" style="flex:0 1 150px"><label for="s-age">Age now (for children)</label><input id="s-age" type="number" min="0" max="25" step="0.5" value="' + esc(d.age) + '"></div>' +
        '<div class="field" style="flex:0 1 170px"><label for="s-pr">Refer to them as</label><select id="s-pr"><option value="">Automatic</option><option value="she"' + (d.pronoun === 'she' ? ' selected' : '') + '>she / her</option><option value="he"' + (d.pronoun === 'he' ? ' selected' : '') + '>he / him</option><option value="they"' + (d.pronoun === 'they' ? ' selected' : '') + '>they / them</option></select></div></div>' +
        '<div class="field"><label for="s-why">Your why, in one sentence (optional)</label><input id="s-why" value="' + esc(d.why) + '" placeholder="' + esc(WHY_HINT[d.relation] || WHY_HINT.other) + '"></div>',
      () => '<h2>Your day</h2><p class="muted">Your plan and reminders are built around this. Study goes where you are fresh; family and sleep are protected.</p>' +
        '<div class="field"><label>Office hours</label><div class="picks">' + PRESETS.map((x) => chip('pre', x.id, x.label, d.os === x.os && d.oe === x.oe)).join('') + chip('pre', 'custom', 'Custom', !PRESETS.some((x) => d.os === x.os && d.oe === x.oe)) + '</div></div>' +
        '<div class="row"><div class="field"><label for="s-os">Office starts</label><input id="s-os" type="time" value="' + d.os + '"></div><div class="field"><label for="s-oe">Office ends</label><input id="s-oe" type="time" value="' + d.oe + '"></div>' +
        '<div class="field"><label for="s-c">Commute (min, 0 if from home)</label><input id="s-c" type="number" min="0" max="180" value="' + d.commute + '"></div></div>' +
        '<div class="row"><div class="field"><label for="s-w">Wake up</label><input id="s-w" type="time" value="' + d.wake + '"></div><div class="field"><label for="s-s">Sleep</label><input id="s-s" type="time" value="' + d.sleep + '"></div></div>' +
        '<fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font-weight:700;font-size:14px;margin-bottom:6px">Office days</legend><div class="row" style="gap:16px">' +
        [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']].map(([v, t]) => '<label class="inline"><input type="checkbox" name="swd" value="' + v + '"' + (d.workDays.includes(v) ? ' checked' : '') + '>' + t + '</label>').join('') + '</div></fieldset>',
      () => '<h2>Your pace</h2><p class="muted">Start smaller than you think. The habit matters more than the hours in the first weeks.</p>' +
        '<div class="field"><label>Hours a week you can give</label><div class="picks">' + [5, 8, 10, 12, 15].map((h) => chip('wk', h, h + ' h', +d.weekly === h)).join('') + '</div></div>' +
        '<div class="field"><label>Start at</label><div class="picks">' + D.levels.map((lv) => chip('lv', lv.n, 'Level ' + lv.n + ': ' + lv.name + ' (' + lv.sd + '+' + lv.dsa + ' min)', +d.level === lv.n)).join('') + '</div><p class="small muted">Level 1 is recommended even if it feels easy.</p></div>' +
        '<div class="row"><div class="field"><label>Rest days a week</label><div class="picks">' + [0, 1, 2].map((r) => chip('rs', r, String(r), +d.rest === r)).join('') + '</div></div>' +
        '<div class="field"><label>Motivating notifications a day</label><div class="picks">' + [[0, 'Off'], [3, '3'], [4, '4']].map(([v, t]) => chip('mo', v, t, +d.motiv === v)).join('') + '</div></div></div>',
      () => {
        commitDraft(false);
        const pb = buildPlan(); const sd = pb.weekday.find((x) => x.kind === 'sd'); const dsa = pb.weekday.find((x) => x.kind === 'dsa'); const sl = pb.weekday.find((x) => x.kind === 'sleep');
        return '<h2>Your plan is ready' + (d.me ? ', ' + esc(d.me) : '') + '</h2>' +
          '<ul class="st-list"><li>Doing this for <b>' + esc(isSelf() ? 'yourself' : who()) + '</b>' + (d.why ? ': “' + esc(d.why) + '”' : '') + '</li>' +
          '<li>Deep work at <b>' + (sd ? ampm(sd.s) : '—') + '</b>, DSA at <b>' + (dsa ? ampm(dsa.s) : '—') + '</b>, sleep by <b>' + (sl ? ampm(sl.s) : '—') + '</b></li>' +
          '<li>' + esc(d.weekly) + ' hours a week, starting at level ' + esc(d.level) + '</li>' +
          (d.targetDate ? '<li>Offer by <b>' + esc(niceDate(d.targetDate)) + '</b></li>' : '') + '</ul>' +
          '<p class="muted">Change anything later on My why, My day and Reminders.</p>';
      }
    ];
    function read() {
      const v = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : undefined; };
      const r = (n) => { const e = box.querySelector('input[name=' + n + ']:checked'); return e ? e.value : undefined; };
      if (step === 1) { d.me = v('s-me'); d.years = v('s-y'); d.companyType = r('ct') || d.companyType; d.role = v('s-role'); d.companies = v('s-co'); d.targetDate = v('s-td'); }
      if (step === 2) { d.relation = r('rel') || d.relation; d.name = v('s-nm'); d.age = v('s-age'); d.pronoun = v('s-pr'); d.why = v('s-why'); }
      if (step === 3) { d.os = v('s-os') || d.os; d.oe = v('s-oe') || d.oe; d.commute = +v('s-c') || 0; d.wake = v('s-w') || d.wake; d.sleep = v('s-s') || d.sleep; const wd = [...box.querySelectorAll('input[name=swd]:checked')].map((x) => +x.value); d.workDays = wd.length ? wd : [1, 2, 3, 4, 5]; }
      if (step === 4) { d.weekly = +(r('wk') || d.weekly); d.level = +(r('lv') || d.level); d.rest = +(r('rs') !== undefined ? r('rs') : d.rest); d.motiv = +(r('mo') !== undefined ? r('mo') : d.motiv); }
    }
    function commitDraft(final) {
      p.me = d.me; p.years = d.years === '' ? '' : Math.max(1, Math.min(45, parseInt(d.years, 10) || 1)); p.companyType = d.companyType; p.role = d.role; p.companies = d.companies; p.targetDate = d.targetDate;
      const old = motive();
      p.motive = { relation: d.relation, name: d.name, age: d.age === '' ? '' : Math.max(0, Math.min(25, +d.age)), ageAt: String(old.age) === String(d.age) && old.ageAt ? old.ageAt : Date.now(), pronoun: d.pronoun };
      p.why = d.why;
      p.life = { officeStart: d.os, officeEnd: d.oe, commute: d.commute, wake: d.wake, sleep: d.sleep, workDays: d.workDays };
      p.weeklyHours = d.weekly;
      const weeks = d.targetDate ? Math.max(4, daysBetween(today(), d.targetDate) / 7) : 40;
      p.hoursGoal = Math.max(50, Math.round(d.weekly * weeks * 0.85 / 10) * 10);
      if (final) {
        if (S.settings.level !== d.level) { S.settings.level = d.level; S.settings.levelSince = today(); }
        S.settings.restPerWeek = d.rest;
        S.settings.motiv = Object.assign({}, S.settings.motiv, { on: d.motiv > 0, count: d.motiv || 3 });
        S.setupDone = true; applyPlan(true);
      }
    }
    function draw() {
      const last = step === steps.length - 1;
      box.innerHTML = '<div class="st-prog" aria-hidden="true">' + steps.map((_, k) => '<i class="' + (k <= step ? 'on' : '') + '"></i>').join('') + '</div>' +
        '<div class="st-body">' + steps[step]() + '</div>' +
        '<div class="st-nav">' + (step ? '<button class="btn" type="button" id="st-back">Back</button>' : '<button class="btn quiet" type="button" id="st-skip">Skip setup</button>') +
        '<button class="btn ' + (last ? 'haldi' : 'primary') + '" type="button" id="st-next">' + (step === 0 ? 'Make it mine' : last ? 'Start' : 'Next') + '</button></div>';
      const nb = document.getElementById('st-next'), bb = document.getElementById('st-back'), sk = document.getElementById('st-skip');
      nb.onclick = () => { read(); if (last) { commitDraft(true); location.href = 'index.html'; } else { step++; draw(); window.scrollTo({ top: 0 }); } };
      if (bb) bb.onclick = () => { read(); step--; draw(); };
      if (sk) sk.onclick = () => { commitDraft(true); location.href = 'index.html'; };
      box.querySelectorAll('input[name=pre]').forEach((x) => { x.onchange = () => { const ps = PRESETS.find((q) => q.id === x.value); if (ps) { document.getElementById('s-os').value = ps.os; document.getElementById('s-oe').value = ps.oe; document.getElementById('s-w').value = ps.wake; document.getElementById('s-s').value = ps.sleep; } }; });
      box.querySelectorAll('input[name=rel]').forEach((x) => { x.onchange = () => { const why = document.getElementById('s-why'); if (why) why.placeholder = WHY_HINT[x.value] || WHY_HINT.other; const self = x.value === 'myself'; document.getElementById('s-who').style.display = self ? 'none' : ''; document.getElementById('s-agef').style.display = REL[x.value] && REL[x.value].child ? '' : 'none'; }; });
      const sel = box.querySelector('input[name=rel]:checked');
      if (document.getElementById('s-who')) { document.getElementById('s-who').style.display = sel && sel.value === 'myself' ? 'none' : ''; document.getElementById('s-agef').style.display = sel && REL[sel.value] && REL[sel.value].child ? '' : 'none'; }
    }
    draw();
  }

  // ---------- mock interview simulator: a 45-minute system design round, phase by phase ----------
  const MOCK_PHASES = [
    { k: 'req', t: 'Clarify requirements', min: 5, ask: ['Who consumes this data, and how fresh must it be?', 'What must never be wrong: counts, money, order?', 'What scale are we designing for, today and in two years?'] },
    { k: 'est', t: 'Estimate the scale', min: 5, ask: ['Events per second at peak?', 'Storage per day and per year, after compression?', 'How many partitions or workers does that imply?'] },
    { k: 'hld', t: 'High-level design', min: 15, ask: ['Walk me through ingestion, processing, storage and serving.', 'Batch, streaming or both, and why?', 'What does the data model look like?'] },
    { k: 'deep', t: 'Deep dive', min: 12, ask: [] },
    { k: 'ops', t: 'Failures, operations, trade-offs', min: 5, ask: ['A job fails at 3 am and replays an hour. What happens to correctness?', 'How do you backfill a year without hurting production?', 'What did you trade away, and when would you choose differently?'] },
    { k: 'wrap', t: 'Wrap-up', min: 3, ask: ['Summarise your design in 60 seconds, as if to the interviewer’s manager.'] }
  ];
  let MK = null; // running mock
  function pickMockCase() {
    const cases = D.items.filter((i) => i.type === 'case');
    const mine = cases.filter((i) => typeof expFor === 'function' && expFor(i.id));
    const weak = cases.filter((i) => !(st(i.id).scores || []).length);
    const pool = (Math.random() < 0.5 && mine.length ? mine : weak.length ? weak : cases);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function openMockSim(caseId) {
    let d = document.getElementById('mocksim');
    if (!d) { d = document.createElement('dialog'); d.id = 'mocksim'; d.className = 'mocksim'; document.body.appendChild(d); d.addEventListener('cancel', (e) => { if (MK && MK.phase >= 0) { e.preventDefault(); if (confirm('Leave the mock? Your answers so far are kept as a note.')) finishMock(true); } }); }
    const c = byId[caseId] || pickMockCase();
    const cases = D.items.filter((i) => i.type === 'case');
    d.innerHTML = '<div class="dlg"><div class="dlg-head"><div><p class="muted small" style="margin:0">Mock interview · 45 minutes</p><h2>System design round</h2></div><button class="btn quiet" type="button" data-close>Close</button></div>' +
      '<div class="field"><label for="mk-case">Case</label><select id="mk-case">' + cases.map((i) => '<option value="' + i.id + '"' + (i.id === c.id ? ' selected' : '') + '>' + esc(i.title) + (typeof expFor === 'function' && expFor(i.id) ? ' (you built this)' : '') + '</option>').join('') + '</select></div>' +
      '<div class="prompt"><p style="margin:0" id="mk-prompt">' + esc(c.text) + '</p></div>' +
      '<ol class="mk-plan">' + MOCK_PHASES.map((p) => '<li><b>' + p.t + '</b><span>' + p.min + ' min</span></li>').join('') + '</ol>' +
      '<p class="small muted">Treat it like the real room: answer out loud, use the 🎤 to capture key points in each phase, and keep moving when the phase time is up. The interviewer’s follow-ups arrive during the deep dive.</p>' +
      '<div class="actions"><button class="btn haldi" type="button" id="mk-go">Start the interview</button></div></div>';
    d.querySelector('#mk-case').onchange = (e) => { d.querySelector('#mk-prompt').textContent = byId[e.target.value].text; };
    d.querySelector('#mk-go').onclick = () => {
      const cs = byId[d.querySelector('#mk-case').value];
      MK = { id: cs.id, phase: 0, phaseStart: Date.now(), start: Date.now(), answers: {}, used: {} };
      drawMock();
    };
    if (!d.open) d.showModal();
  }
  function drawMock() {
    const d = document.getElementById('mocksim'); if (!d || !MK) return;
    const c = byId[MK.id]; const p = MOCK_PHASES[MK.phase];
    const asks = p.k === 'deep' ? (c.followUps || []).concat(['What is the single biggest risk in your design?']) : p.ask;
    d.innerHTML = '<div class="dlg mk-run"><div class="mk-top"><div><p class="muted small" style="margin:0">Phase ' + (MK.phase + 1) + ' of ' + MOCK_PHASES.length + ' · ' + esc(c.title) + '</p><h2>' + p.t + '</h2></div><div class="mk-clock" id="mk-clock">' + pad(p.min) + ':00</div></div>' +
      '<div class="mk-bar"><i id="mk-bar"></i></div>' +
      '<div class="mk-ask"><span class="coach-av sm" aria-hidden="true">' + MARK + '</span><div><small>Interviewer</small><p id="mk-q">' + esc(asks[0]) + '</p></div></div>' +
      '<div class="field"><label for="mk-ans">Your key points (speak them with the 🎤 or type)</label><textarea id="mk-ans" rows="6">' + esc(MK.answers[p.k] || '') + '</textarea></div>' +
      '<div class="actions"><button class="btn" type="button" id="mk-quit">End early</button><button class="btn primary" type="button" id="mk-next">' + (MK.phase === MOCK_PHASES.length - 1 ? 'Finish and score' : 'Next phase') + '</button></div></div>';
    MK.asks = asks; MK.askIdx = 0;
    d.querySelector('#mk-ans').oninput = (e) => { MK.answers[p.k] = e.target.value; };
    d.querySelector('#mk-next').onclick = () => { MK.answers[p.k] = d.querySelector('#mk-ans').value; MK.used[p.k] = Math.round((Date.now() - MK.phaseStart) / 1000); if (MK.phase === MOCK_PHASES.length - 1) finishMock(false); else { MK.phase++; MK.phaseStart = Date.now(); drawMock(); } };
    d.querySelector('#mk-quit').onclick = () => { MK.answers[p.k] = d.querySelector('#mk-ans').value; MK.used[p.k] = Math.round((Date.now() - MK.phaseStart) / 1000); finishMock(true); };
  }
  function mockTick() {
    if (!MK || MK.phase < 0) return;
    const p = MOCK_PHASES[MK.phase]; const el = (Date.now() - MK.phaseStart) / 1000; const left = p.min * 60 - el;
    const ck = document.getElementById('mk-clock'); const bar = document.getElementById('mk-bar'); if (!ck) return;
    const a = Math.abs(Math.round(left)); ck.textContent = (left < 0 ? '+' : '') + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
    ck.classList.toggle('over', left < 0); if (bar) bar.style.width = Math.min(100, (el / (p.min * 60)) * 100) + '%';
    // the interviewer asks the next follow-up as the phase moves on
    const step = (p.min * 60) / Math.max(1, MK.asks.length);
    const want = Math.min(MK.asks.length - 1, Math.floor(el / step));
    if (want > MK.askIdx) { MK.askIdx = want; const q = document.getElementById('mk-q'); if (q) { q.textContent = MK.asks[want]; q.parentElement.parentElement.classList.remove('pulse'); void q.offsetWidth; q.parentElement.parentElement.classList.add('pulse'); } }
  }
  function finishMock(early) {
    const c = byId[MK.id]; const total = Math.max(1, Math.round((Date.now() - MK.start) / 60000));
    const d = document.getElementById('mocksim');
    const rows = MOCK_PHASES.filter((p) => MK.used[p.k] !== undefined).map((p) => { const u = Math.round(MK.used[p.k] / 60); return '<tr><td>' + p.t + '</td><td class="num">' + p.min + '</td><td class="num' + (u > p.min + 1 ? ' over' : '') + '">' + u + '</td></tr>'; }).join('');
    d.innerHTML = '<form class="dlg" id="mk-score"><div class="dlg-head"><div><p class="muted small" style="margin:0">' + (early ? 'Ended early' : 'Mock complete') + ' · ' + total + ' min</p><h2>' + esc(c.title) + '</h2></div></div>' +
      '<div class="tablewrap"><table class="dtable"><thead><tr><th>Phase</th><th class="num">Plan (min)</th><th class="num">You (min)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h3 style="margin-top:16px">Score yourself like the interviewer would</h3>' + D.rubric.map((r, i) => '<div class="rubric-row"><span>' + esc(r) + '</span><select name="r' + i + '"><option value="0">0 Missed</option><option value="1" selected>1 Partly</option><option value="2">2 Clearly</option></select></div>').join('') +
      '<div class="actions" style="margin-top:14px"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="mk-export">Save and export for AI review</button></div></form>';
    const saveMock = (exportIt) => {
      const f = d.querySelector('#mk-score'); const vals = D.rubric.map((_, i) => +f.elements['r' + i].value); const tot = vals.reduce((a, b) => a + b, 0);
      const s2 = st(c.id); s2.scores = (s2.scores || []).concat([{ at: Date.now(), vals, total: tot }]);
      s2.notes = (s2.notes || []).concat([{ id: 'n' + Date.now(), type: 'Summary', body: 'Mock interview (' + total + ' min):\n' + MOCK_PHASES.filter((p) => MK.answers[p.k]).map((p) => p.t + ': ' + MK.answers[p.k]).join('\n'), at: Date.now() }]);
      S.items[c.id] = s2;
      S.sessions.push({ id: 's' + Date.now(), date: today(), track: 'sd', itemId: c.id, minutes: Math.min(total, 60), min: minNow(), activity: 'full', part: 'Mock interview', source: 'mock', at: Date.now() });
      S.mocks = (S.mocks || []).concat([{ id: 'mk' + Date.now(), date: today(), type: 'sd', with: 'DataLeap simulator: ' + c.title, score: tot >= 12 ? 4 : tot >= 10 ? 3 : tot >= 7 ? 2 : 1, well: '', fix: D.rubric.filter((_, i) => vals[i] === 0).join('; '), at: Date.now() }]);
      if (tot >= 10 && !['done', 'mastered'].includes(s2.status)) setStatus(c.id, 'done');
      save();
      if (exportIt) {
        const md = '# Mock system design interview: ' + c.title + '\n\nPrompt: ' + c.text + '\n\nFollow-ups asked: ' + (c.followUps || []).join(' | ') + '\n\nTotal time: ' + total + ' min. Self-score ' + tot + '/14.\n\n' +
          MOCK_PHASES.map((p) => '## ' + p.t + ' (plan ' + p.min + ' min, used ' + Math.round((MK.used[p.k] || 0) / 60) + ' min)\n\n' + (MK.answers[p.k] || '(no notes)')).join('\n\n') +
          '\n\n## Ask Claude\n\nAct as a staff data engineer interviewer at a top product company. Grade this answer on the staff rubric (scoping, sizing, trade-offs, correctness under failure, operability, platform view, migration path), say what a strong-hire answer would add, and give me the 3 most important fixes.';
        if (BR && BR.saveFile) BR.saveFile('mock-' + today() + '.md', 'text/markdown', md); else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = 'mock-' + today() + '.md'; a.click(); }
      }
      MK = null; d.close();
      showCoachCard(tot >= 10 ? tot + '/14: a hire signal. Do one more this week on a case you did not build.' : tot + '/14. The cheapest place to learn this is here. Redo the weakest phase tomorrow, then try another case.');
      checkProgress(); refresh();
    };
    d.querySelector('#mk-score').onsubmit = (e) => { e.preventDefault(); saveMock(false); };
    d.querySelector('#mk-export').onclick = () => saveMock(true);
    MK.phase = -1;
  }
  setInterval(mockTick, 500);
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-mocksim]'); if (b) { e.preventDefault(); const dl = document.getElementById('itemdlg'); if (dl && dl.open) dl.close(); openMockSim(b.dataset.mocksim); } });
  // ---------- 2-minute recall drill: spaced repetition on YOUR notes ----------
  function drillCards() {
    S.drill = S.drill || {};
    const withNotes = D.items.filter((i) => (st(i.id).notes || []).length);
    const fresh = D.items.filter((i) => i.track === 'sd' && i.type !== 'lesson' && ['done', 'in_progress', 'revise'].includes(st(i.id).status) && !(st(i.id).notes || []).length);
    const due = (id) => !S.drill[id] || S.drill[id].due <= today();
    const cards = withNotes.filter((i) => due(i.id)).sort((a, b) => ((S.drill[a.id] || {}).due || '') > ((S.drill[b.id] || {}).due || '') ? 1 : -1);
    return cards.concat(fresh.filter((i) => due(i.id))).slice(0, 5);
  }
  function openDrill() {
    const cards = drillCards(); const start = Date.now(); let k = 0;
    let d = document.getElementById('drilldlg'); if (!d) { d = document.createElement('dialog'); d.id = 'drilldlg'; d.className = 'drill'; document.body.appendChild(d); }
    if (!cards.length) {
      d.innerHTML = '<div class="dlg"><h2>Nothing to recall yet</h2><p>The drill uses your own notes. Add a key note to a few items you have studied (a 🎤 makes it quick), and they come back here on a schedule.</p><div class="actions"><button class="btn primary" type="button" data-close>OK</button></div></div>';
      d.showModal(); return;
    }
    const show = (revealed) => {
      const i = cards[k]; const s = st(i.id); const note = (s.notes || []).find((n) => n.id === s.pinned) || (s.notes || []).slice(-1)[0];
      d.innerHTML = '<div class="dlg"><div class="dlg-head"><p class="muted small" style="margin:0">Recall drill · ' + (k + 1) + ' of ' + cards.length + '</p><button class="btn quiet" type="button" data-close>Stop</button></div>' +
        '<div class="card-face"><p class="muted small">' + esc((topicBy[i.topic] || {}).name || '') + '</p><h2>' + esc(i.title) + '</h2><p class="hint">' + (note ? 'Say your answer out loud in 30 seconds, then check it against your note.' : 'Explain it out loud in 60 seconds: what it is, when to use it, the main trade-off.') + '</p>' +
        (revealed ? (note ? '<div class="reveal"><small>' + esc(note.type) + '</small><p>' + esc(note.body) + '</p></div>' : '<div class="reveal"><p>No note yet. Open the item and write the one thing you want to remember.</p></div>') : '') + '</div>' +
        (revealed ? '<p class="small muted">How well did you recall it?</p><div class="actions grade"><button class="btn" data-g="0" type="button">Missed it</button><button class="btn" data-g="1" type="button">Partly</button><button class="btn primary" data-g="2" type="button">Got it</button></div>'
          : '<div class="actions"><button class="btn haldi" type="button" id="dr-show">Show my note</button></div>') + '</div>';
      const sb = d.querySelector('#dr-show'); if (sb) sb.onclick = () => show(true);
      d.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => {
        const g = +b.dataset.g; const cur = S.drill[i.id] || { iv: 1 };
        const iv = g === 0 ? 1 : g === 1 ? Math.max(2, Math.round(cur.iv * 1.5)) : Math.min(60, Math.round(cur.iv * 2.5) || 3);
        S.drill[i.id] = { iv, due: addDays(today(), iv), last: g };
        k++;
        if (k < cards.length) show(false); else done();
      }; });
    };
    const done = () => {
      const mins = Math.max(1, Math.round((Date.now() - start) / 60000));
      S.sessions.push({ id: 's' + Date.now(), date: today(), track: 'sd', itemId: null, minutes: mins, min: minNow(), activity: 'revise', part: 'Recall drill', source: 'drill', at: Date.now() });
      save(); d.close(); refresh();
      showCoachCard(cards.length + ' recalled in ' + mins + ' min. Recall, not rereading, is what makes it stick in the interview room.');
      checkProgress();
    };
    show(false); if (!d.open) d.showModal();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-drill]')) { e.preventDefault(); openDrill(); } });

  // ---------- applications: from referral to offer ----------
  const APP_STAGES = [['target', 'Target'], ['referral', 'Referral asked'], ['applied', 'Applied'], ['screen', 'Recruiter screen'], ['loop', 'Interviews'], ['offer', 'Offer'], ['closed', 'Closed']];
  const inr = (v) => { const n = +v || 0; return n >= 100 ? (n / 100).toFixed(2).replace(/\.00$/, '') + ' Cr' : n + ' L'; };
  const firstYear = (a) => (+a.fixed || 0) + (+a.variable || 0) + (+a.stockYr || 0) + (+a.joining || 0);
  function followUpsDue() { return (S.apps || []).filter((a) => a.next && a.nextAt && a.nextAt <= today() && !['closed'].includes(a.stage)); }
  function openApp(id) {
    S.apps = S.apps || [];
    const a = S.apps.find((x) => x.id === id) || { id: 'ap' + Date.now(), company: '', role: S.profile.role || '', level: '', stage: 'target', source: 'referral', next: '', nextAt: '', notes: '' };
    let d = document.getElementById('appdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'appdlg'; document.body.appendChild(d); }
    d.innerHTML = '<form class="dlg" id="appform"><div class="dlg-head"><h2>' + (a.company ? esc(a.company) : 'New application') + '</h2><button class="btn quiet" type="button" data-close>Close</button></div>' +
      '<div class="row"><div class="field"><label for="ap-co">Company</label><input id="ap-co" name="company" value="' + esc(a.company) + '" required></div><div class="field"><label for="ap-role">Role</label><input id="ap-role" name="role" value="' + esc(a.role) + '"></div><div class="field" style="flex:0 1 140px"><label for="ap-lv">Level</label><input id="ap-lv" name="level" value="' + esc(a.level) + '" placeholder="e.g. L6, IC5"></div></div>' +
      '<div class="row"><div class="field"><label for="ap-st">Stage</label><select id="ap-st" name="stage">' + APP_STAGES.map(([v, t]) => '<option value="' + v + '"' + (v === a.stage ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="ap-src">Source</label><select id="ap-src" name="source">' + [['referral', 'Referral'], ['recruiter', 'Recruiter reached out'], ['portal', 'Careers site / portal'], ['other', 'Other']].map(([v, t]) => '<option value="' + v + '"' + (v === a.source ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div>' +
      '<div class="row"><div class="field"><label for="ap-nx">Next action</label><input id="ap-nx" name="next" value="' + esc(a.next) + '" placeholder="e.g. Follow up with recruiter"></div><div class="field" style="flex:0 1 170px"><label for="ap-nd">By</label><input id="ap-nd" name="nextAt" type="date" value="' + esc(a.nextAt) + '"></div></div>' +
      '<details class="rubricbox"' + (a.stage === 'offer' ? ' open' : '') + '><summary><b>Offer details</b> (lakh per year)</summary><div class="row" style="margin-top:8px"><div class="field"><label for="ap-f">Fixed</label><input id="ap-f" name="fixed" type="number" step="0.1" value="' + esc(a.fixed || '') + '"></div><div class="field"><label for="ap-v">Variable / bonus</label><input id="ap-v" name="variable" type="number" step="0.1" value="' + esc(a.variable || '') + '"></div><div class="field"><label for="ap-s">Stock per year</label><input id="ap-s" name="stockYr" type="number" step="0.1" value="' + esc(a.stockYr || '') + '"></div><div class="field"><label for="ap-j">Joining bonus</label><input id="ap-j" name="joining" type="number" step="0.1" value="' + esc(a.joining || '') + '"></div></div></details>' +
      '<div class="field"><label for="ap-no">Notes: contacts, interview feedback</label><textarea id="ap-no" name="notes" rows="3">' + esc(a.notes) + '</textarea></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Save</button>' + (S.apps.some((x) => x.id === a.id) ? '<button class="btn" type="button" id="ap-del">Delete</button>' : '') + '</div></form>';
    const f = d.querySelector('#appform');
    f.onsubmit = (e) => {
      e.preventDefault(); const n = { id: a.id, updated: Date.now() };
      ['company', 'role', 'level', 'stage', 'source', 'next', 'nextAt', 'notes', 'fixed', 'variable', 'stockYr', 'joining'].forEach((k) => { n[k] = f.elements[k].value.trim(); });
      const moved = a.stage !== n.stage; S.apps = S.apps.filter((x) => x.id !== n.id).concat([n]); save(); d.close(); refresh(); setTimeout(checkProgress, 1200);
      if (moved && n.stage === 'offer') { releaseBalloons(8, ['family'], true); showCoachCard('An offer from ' + n.company + '. This is what every early morning was for. Compare it calmly before you answer.'); }
      else if (moved && n.stage === 'loop') showCoachCard(n.company + ' interviews: ask the recruiter for the loop structure and do one mock of each round this week.');
      else if (moved && n.stage === 'closed') showCoachCard('A closed door is information, not a verdict. Note what you learned, then on to the next one.');
    };
    const del = d.querySelector('#ap-del'); if (del) del.onclick = () => { if (confirm('Delete this application?')) { S.apps = S.apps.filter((x) => x.id !== a.id); save(); d.close(); refresh(); } };
    if (!d.open) d.showModal();
  }
  function appsBoard() {
    const apps = S.apps || [];
    const due = followUpsDue();
    const offers = apps.filter((a) => a.stage === 'offer' && firstYear(a) > 0).sort((a, b) => firstYear(b) - firstYear(a));
    return (due.length ? '<div class="banner"><b>Follow up today:</b> ' + due.map((a) => esc(a.company) + ' (' + esc(a.next) + ')').join(', ') + '</div>' : '') +
      '<div class="board">' + APP_STAGES.map(([v, t]) => { const list = apps.filter((a) => a.stage === v); return '<div class="col"><div class="col-h">' + t + ' <span>' + list.length + '</span></div>' +
        list.map((a) => '<button class="appcard" type="button" data-app="' + a.id + '"><b>' + esc(a.company) + '</b><span>' + esc([a.role, a.level].filter(Boolean).join(' · ')) + '</span>' + (a.next ? '<small class="' + (a.nextAt && a.nextAt <= today() ? 'late' : '') + '">' + esc(a.next) + (a.nextAt ? ' · ' + shortDate(a.nextAt) : '') + '</small>' : '') + '</button>').join('') + '</div>'; }).join('') + '</div>' +
      '<p class="actions" style="margin-top:12px"><button class="btn primary" type="button" data-app="">Add an application</button></p>' +
      (offers.length ? '<h3>Offers compared (first year, lakh)</h3><div class="tablewrap"><table class="dtable"><thead><tr><th>Company</th><th class="num">Fixed</th><th class="num">Variable</th><th class="num">Stock/yr</th><th class="num">Joining</th><th class="num">First year</th></tr></thead><tbody>' +
        offers.map((a, i) => '<tr><td><b>' + esc(a.company) + '</b>' + (i === 0 && offers.length > 1 ? ' <span class="chip st-done">Highest</span>' : '') + '</td><td class="num">' + (a.fixed || 0) + '</td><td class="num">' + (a.variable || 0) + '</td><td class="num">' + (a.stockYr || 0) + '</td><td class="num">' + (a.joining || 0) + '</td><td class="num"><b>' + inr(firstYear(a)) + '</b></td></tr>').join('') + '</tbody></table></div><p class="small muted">First-year total is not everything: compare level, team, growth and how the stock vests.</p>' : '');
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-app]'); if (b) { e.preventDefault(); openApp(b.dataset.app); } });

  // ---------- fitness: the second goal ----------
  const PROGRAM = {
    A: { name: 'Strength A', items: [['Squat (goblet or barbell)', '3 × 8'], ['Bench press or push-ups', '3 × 8–10'], ['Seated or dumbbell row', '3 × 10'], ['Romanian deadlift', '3 × 10'], ['Plank', '3 × 40 s']] },
    B: { name: 'Strength B', items: [['Trap-bar or regular deadlift', '3 × 5'], ['Overhead press', '3 × 8'], ['Lat pulldown or pull-ups', '3 × 8'], ['Walking lunges', '3 × 10 each leg'], ['Farmer’s carry', '3 × 40 m']] },
    C: { name: 'Conditioning', items: [['Warm-up: brisk walk or easy bike', '10 min'], ['Intervals on bike or rower: 1 min hard, 2 min easy', '6 rounds'], ['Steady zone-2 cardio (you can still talk)', '15–20 min'], ['Mobility: hips, hamstrings, shoulders', '10 min']] },
    W: { name: 'Walk and mobility', items: [['Brisk walk, ideally with family', '30–40 min'], ['Mobility and stretching', '10 min']] }
  };
  function fit() {
    return Object.assign({ on: true, startKg: 72, goalKg: 65, goalDate: '2027-04-30', gymDays: [1, 2, 4, 5, 6], gymMin: 60, rotation: { 1: 'A', 2: 'B', 4: 'A', 5: 'B', 6: 'C' }, steps: 9000 }, S.profile.fit || {});
  }
  const isGymDay = (date) => fit().on && fit().gymDays.includes(dow(date));
  function workoutFor(date) { const f = fit(); if (!f.on) return null; return isGymDay(date) ? PROGRAM[f.rotation[dow(date)] || 'A'] : PROGRAM.W; }
  const workoutsOn = (date) => (S.workouts || []).filter((w) => w.date === date);
  const gymDone = (date) => workoutsOn(date).some((w) => w.minutes >= 20);
  function weightNow() { const w = (S.weights || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1)); return w.length ? w[w.length - 1].kg : fit().startKg; }
  function weightTrend() {
    const w = (S.weights || []).filter((x) => x.date > addDays(today(), -28)).sort((a, b) => (a.date > b.date ? 1 : -1));
    if (w.length < 3 || daysBetween(w[0].date, w[w.length - 1].date) < 7) return null;
    const xs = w.map((x) => daysBetween(w[0].date, x.date)); const ys = w.map((x) => x.kg); const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) * (x - mx), 0);
    return { perWeek: slope * 7, now: my + slope * (xs[n - 1] - mx) };
  }
  function fitEta() {
    const t = weightTrend(); const f = fit(); if (!t || t.perWeek >= -0.05) return null;
    const weeks = (t.now - f.goalKg) / -t.perWeek; return weeks <= 0 ? today() : addDays(today(), Math.round(weeks * 7));
  }
  function weekWorkouts() { const ws = weekStart(today()); return (S.workouts || []).filter((w) => w.date >= ws && w.date <= today() && w.minutes >= 20).length; }

  function openWorkoutLog(prefillType) {
    const t = today(); const wo = workoutFor(t) || PROGRAM.W;
    let d = document.getElementById('wodlg'); if (!d) { d = document.createElement('dialog'); d.id = 'wodlg'; document.body.appendChild(d); }
    const types = [['A', PROGRAM.A.name], ['B', PROGRAM.B.name], ['C', PROGRAM.C.name], ['W', PROGRAM.W.name], ['O', 'Other: sport, swim, yoga']];
    const curKey = Object.keys(PROGRAM).find((k) => PROGRAM[k] === wo) || 'W';
    d.innerHTML = '<form class="dlg" id="woform"><div class="dlg-head"><h2>Log workout</h2><button class="btn quiet" type="button" data-close>Close</button></div>' +
      '<div class="row"><div class="field"><label for="wo-t">Workout</label><select id="wo-t">' + types.map(([k, n]) => '<option value="' + k + '"' + (k === (prefillType || curKey) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="field" style="flex:0 1 120px"><label for="wo-m">Minutes</label><input id="wo-m" type="number" min="5" max="240" value="' + fit().gymMin + '"></div>' +
      '<div class="field" style="flex:0 1 150px"><label for="wo-d">Day</label><input id="wo-d" type="date" value="' + t + '"></div></div>' +
      '<div class="row"><div class="field" style="flex:0 1 160px"><label for="wo-kg">Weight today (kg, optional)</label><input id="wo-kg" type="number" step="0.1" min="30" max="200"></div>' +
      '<div class="field"><label for="wo-n">Note: weights, how it felt</label><input id="wo-n" placeholder="e.g. Squat 50 kg 3×8, felt strong"></div></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Save</button></div></form>';
    d.querySelector('#woform').onsubmit = (e) => {
      e.preventDefault(); const date = d.querySelector('#wo-d').value || t; const mins = Math.max(5, Math.min(240, +d.querySelector('#wo-m').value || 0));
      const key = d.querySelector('#wo-t').value; const before = gymDone(date);
      S.workouts = (S.workouts || []).concat([{ id: 'w' + Date.now(), date, type: key, name: key === 'O' ? 'Other' : PROGRAM[key].name, minutes: mins, note: d.querySelector('#wo-n').value.trim(), at: Date.now() }]);
      const kg = parseFloat(d.querySelector('#wo-kg').value); if (kg > 30) logWeight(kg, date, true);
      save(); d.close(); refresh();
      showCoachCard(!before && mins >= 20 ? 'Workout done. ' + weekWorkouts() + ' this week. A stronger body carries the long shift and the deep work.' : 'Logged ' + mins + ' minutes. Movement counts.');
      checkProgress();
    };
    d.showModal();
  }
  function logWeight(kg, date, quiet) {
    date = date || today(); S.weights = (S.weights || []).filter((w) => w.date !== date).concat([{ date, kg: Math.round(kg * 10) / 10, at: Date.now() }]); save();
    if (!quiet) { const lost = Math.round((fit().startKg - kg) * 10) / 10; showCoachCard(lost > 0 ? lost + ' kg down from ' + fit().startKg + '. Watch the weekly average, not single days.' : 'Logged. Daily numbers jump with water and salt; the 2-week trend is what counts.'); }
    checkProgress();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-workout]')) { e.preventDefault(); openWorkoutLog(e.target.closest('[data-workout]').dataset.workout || ''); } });

  function fitCard() {
    const f = fit(); if (!f.on) return '';
    const t = today(); const wo = workoutFor(t); const done = gymDone(t); const gym = isGymDay(t);
    const blk = (blocksFor(t) || []).find((b) => b.kind === 'health');
    return '<article class="fitcard' + (done ? ' done' : '') + '"><div><p class="fit-k">' + (gym ? 'Gym' : 'Move') + (blk ? ' · ' + ampm(blk.s) : '') + '</p><h2>' + esc(wo.name) + '</h2><p class="muted small" style="margin:0">' + (done ? 'Done today. ' : '') + weekWorkouts() + ' of ' + f.gymDays.length + ' workouts this week · ' + weightNow() + ' kg → ' + f.goalKg + ' kg</p></div>' +
      '<div class="actions"><button class="btn ' + (done ? '' : 'primary') + '" type="button" data-workout="">' + (done ? 'Log another' : 'Log workout') + '</button><button class="btn" type="button" data-addmeal="">Log meal</button><a class="btn quiet" href="fit.html">Plan, weight, food</a></div></article>';
  }

  function weightChart() {
    const f = fit(); const w = (S.weights || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1));
    const start = w.length ? w[0].date : today(); const end = f.goalDate > today() ? f.goalDate : addDays(today(), 30);
    const span = Math.max(14, daysBetween(start, end)); const W = 420, H = 230, pL = 34, pB = 24, pT = 18;
    const lo = Math.min(f.goalKg - 1, ...w.map((x) => x.kg)), hi = Math.max(f.startKg + 1, ...w.map((x) => x.kg));
    const x = (d) => pL + (daysBetween(start, d) / span) * (W - pL - 10); const y = (kg) => H - pB - ((kg - lo) / (hi - lo)) * (H - pB - pT);
    let g = '';
    [lo, (lo + hi) / 2, hi].forEach((v) => { g += '<line x1="' + pL + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (pL - 6) + '" y="' + (y(v) + 4) + '" class="ax" text-anchor="end">' + Math.round(v) + '</text>'; });
    g += '<line x1="' + pL + '" x2="' + (W - 6) + '" y1="' + y(f.goalKg) + '" y2="' + y(f.goalKg) + '" class="goal"/><text x="' + (W - 8) + '" y="' + (y(f.goalKg) - 6) + '" class="ax" text-anchor="end">goal ' + f.goalKg + ' kg</text>';
    g += '<line x1="' + x(start) + '" y1="' + y(w.length ? w[0].kg : f.startKg) + '" x2="' + x(f.goalDate) + '" y2="' + y(f.goalKg) + '" class="tgt"/>';
    if (w.length) g += '<polyline points="' + w.map((p) => x(p.date) + ',' + y(p.kg)).join(' ') + '" class="wline"/>' + w.map((p) => '<circle cx="' + x(p.date) + '" cy="' + y(p.kg) + '" r="3.5" class="wdot"><title>' + p.date + ': ' + p.kg + ' kg</title></circle>').join('');
    g += '<text x="' + pL + '" y="' + (H - 6) + '" class="ax">' + shortDate(start) + '</text><text x="' + (W - 8) + '" y="' + (H - 6) + '" class="ax" text-anchor="end">' + shortDate(end) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Weight over time with goal">' + g + '</svg>';
  }

  function renderFit() {
    const f = fit(); const now = weightNow(); const lost = Math.round((f.startKg - now) * 10) / 10; const toGo = Math.round((now - f.goalKg) * 10) / 10;
    const eta = fitEta(); const tr = weightTrend();
    const hs = document.getElementById('fitstats');
    if (hs) hs.innerHTML = '<div class="stat hl"><b>' + now + '</b><span>kg now</span></div><div class="stat"><b>' + (lost > 0 ? '−' + lost : '0') + '</b><span>kg since ' + f.startKg + '</span></div><div class="stat"><b>' + Math.max(0, toGo) + '</b><span>kg to ' + f.goalKg + '</span></div><div class="stat"><b>' + weekWorkouts() + '/' + f.gymDays.length + '</b><span>workouts this week</span></div>';
    const pc = document.getElementById('fitpace');
    if (pc) pc.innerHTML = tr ? '<div class="pace ' + (tr.perWeek <= -0.3 ? 'good' : 'behind') + '"><b>' + (tr.perWeek <= -0.3 ? 'On track.' : tr.perWeek < 0 ? 'Slow but moving.' : 'Not going down yet.') + '</b> Trend: ' + (tr.perWeek > 0 ? '+' : '') + (Math.round(tr.perWeek * 100) / 100) + ' kg a week. ' + (eta ? 'At this pace you reach ' + f.goalKg + ' kg around <b>' + esc(shortDate(eta)) + '</b>.' : 'Aim for 0.4 to 0.6 kg a week: check the late-night eating after office first.') + '</div>'
      : '<p class="muted" style="margin:14px 0 0">Weigh in on 3 or more mornings over a week and your trend and finish date appear here.</p>';
    const wf = document.getElementById('weighform');
    if (wf && !wf.dataset.ready) { wf.dataset.ready = '1'; wf.onsubmit = (e) => { e.preventDefault(); const kg = parseFloat(wf.elements.kg.value); if (kg > 30 && kg < 250) { logWeight(kg, today(), false); wf.reset(); renderFit(); } }; }
    const ch = document.getElementById('wchart'); if (ch) ch.innerHTML = weightChart() + '<div class="legend"><span><i class="lg-avg" style="border-top-color:var(--blue)"></i>Your weight</span><span><i class="lg-tgt"></i>Planned pace</span><span><i class="lg-goal"></i>Goal</span></div>';
    const pg = document.getElementById('program');
    if (pg) {
      const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      pg.innerHTML = '<p class="muted">Your week: ' + [1, 2, 3, 4, 5, 6, 0].map((d) => DN[d] + ' ' + (f.gymDays.includes(d) ? '<b>' + PROGRAM[f.rotation[d] || 'A'].name + '</b>' : 'walk')).join(' · ') + '</p><div class="fitgrid">' +
        ['A', 'B', 'C'].map((k) => '<div class="fit' + (workoutFor(today()) === PROGRAM[k] ? ' now' : '') + '"><b>' + PROGRAM[k].name + '</b>' + (workoutFor(today()) === PROGRAM[k] ? '<span class="chip st-done">Today</span>' : '') + '<ul>' + PROGRAM[k].items.map(([n, r]) => '<li>' + esc(n) + ' <b>' + esc(r) + '</b></li>').join('') + '</ul></div>').join('') + '</div>' +
        '<p class="small muted" style="margin-top:10px">Start lighter than you think for two weeks and learn the movements. Add a little weight when every rep is clean. Rest 1–2 minutes between sets.</p>';
    }
    const wl = document.getElementById('wolog');
    if (wl) { const ws = (S.workouts || []).slice().sort((a, b) => b.at - a.at).slice(0, 20); wl.innerHTML = ws.length ? '<table class="dtable"><thead><tr><th>Day</th><th>Workout</th><th class="num">Min</th><th>Note</th></tr></thead><tbody>' + ws.map((w) => '<tr><td>' + shortDate(w.date) + '</td><td>' + esc(w.name) + '</td><td class="num">' + w.minutes + '</td><td class="small">' + esc(w.note || '') + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted">No workouts yet. Your first one unlocks a milestone.</p>'; }
    const ff = document.getElementById('fitform');
    if (ff && !ff.dataset.ready) {
      ff.dataset.ready = '1';
      ff.elements.startKg.value = f.startKg; ff.elements.goalKg.value = f.goalKg; ff.elements.goalDate.value = f.goalDate; ff.elements.gymMin.value = f.gymMin;
      ff.querySelectorAll('input[name=gd]').forEach((c) => { c.checked = f.gymDays.includes(+c.value); });
      ff.onsubmit = (e) => {
        e.preventDefault(); const gd = [...ff.querySelectorAll('input[name=gd]:checked')].map((c) => +c.value);
        const rot = {}; const seq = ['A', 'B']; let k = 0; gd.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).forEach((d, i, arr) => { rot[d] = i === arr.length - 1 && arr.length >= 4 ? 'C' : seq[k++ % 2]; });
        S.profile.fit = Object.assign({}, f, { startKg: +ff.elements.startKg.value || f.startKg, goalKg: +ff.elements.goalKg.value || f.goalKg, goalDate: ff.elements.goalDate.value || f.goalDate, gymMin: Math.max(20, Math.min(120, +ff.elements.gymMin.value || 60)), gymDays: gd.length ? gd : f.gymDays, rotation: gd.length ? rot : f.rotation });
        applyPlan(true); save(); renderFit(); showCoachCard('Saved. Your gym blocks and reminders follow the new days.');
      };
    }
  }
  function initFit() { refresh = () => { renderFit(); const fd = document.getElementById('food'); if (fd) fd.innerHTML = foodDiary(); }; refresh(); }

  // ---------- food diary: breakfast, lunch, dinner + as many extra entries as you like ----------
  const MEAL_SLOTS = [['breakfast', 'Breakfast', '08:00'], ['lunch', 'Lunch', '12:30'], ['dinner', 'Dinner', '19:30'], ['snack', 'Snack', ''], ['drink', 'Chai / drink', ''], ['other', 'Other', '']];
  const slotName = (k) => (MEAL_SLOTS.find((x) => x[0] === k) || [, 'Other'])[1];
  let foodDay = null;
  const mealsOn = (date) => (S.meals || []).filter((m) => m.date === date).sort((a, b) => mealMin(a) - mealMin(b));
  // minutes after the day starts (4 am), so a 12:40 am snack sorts after a 7:30 pm dinner
  function mealMin(m) { const t = toMin(m.time || '12:00', 720); return (t - S.settings.dayStart * 60 + 1440) % 1440; }
  function afterOffice(m) {
    if (!m.time) return false; const l = life(); const t = toMin(m.time, 720); let e = toMin(l.officeEnd, 1110);
    const rel = (x) => (x - S.settings.dayStart * 60 + 1440) % 1440;
    return rel(t) >= rel(e);
  }
  function openMeal(id, slot, date) {
    S.meals = S.meals || [];
    const now = new Date(); const nowHM = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const def = MEAL_SLOTS.find((x) => x[0] === slot);
    const m = S.meals.find((x) => x.id === id) || { id: 'm' + Date.now(), date: date || foodDay || today(), slot: slot || 'snack', label: '', time: (def && def[2] && (date || foodDay || today()) !== today()) ? def[2] : nowHM, text: '', protein: '' };
    let d = document.getElementById('mealdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'mealdlg'; document.body.appendChild(d); }
    d.innerHTML = '<form class="dlg" id="mealform"><div class="dlg-head"><div><p class="muted small" style="margin:0">Food diary · ' + esc(niceDate(m.date)) + '</p><h2>' + (S.meals.some((x) => x.id === m.id) ? 'Edit entry' : 'What did you eat?') + '</h2></div><button class="btn quiet" type="button" data-close>Close</button></div>' +
      '<div class="row"><div class="field"><label for="ml-s">Meal</label><select id="ml-s" name="slot">' + MEAL_SLOTS.map(([k, n]) => '<option value="' + k + '"' + (k === m.slot ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
      '<div class="field" style="flex:0 1 130px"><label for="ml-t">Time</label><input id="ml-t" name="time" type="time" value="' + esc(m.time) + '"></div>' +
      '<div class="field" style="flex:0 1 150px"><label for="ml-d">Day</label><input id="ml-d" name="date" type="date" value="' + esc(m.date) + '"></div></div>' +
      '<div class="field"><label for="ml-x">What and how much</label><textarea id="ml-x" name="text" rows="3" placeholder="e.g. 2 rotis, dal 1 bowl, paneer sabzi, curd, salad">' + esc(m.text) + '</textarea></div>' +
      '<div class="row"><div class="field"><label for="ml-l">Label (optional)</label><input id="ml-l" name="label" value="' + esc(m.label) + '" placeholder="e.g. Office break, post-gym, after office"></div>' +
      '<div class="field" style="flex:0 1 150px"><label for="ml-p">Protein, g (optional)</label><input id="ml-p" name="protein" type="number" min="0" max="300" value="' + esc(m.protein) + '"></div></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Save</button>' + (S.meals.some((x) => x.id === m.id) ? '<button class="btn" type="button" id="ml-del">Delete</button>' : '') + '</div></form>';
    const f = d.querySelector('#mealform');
    f.elements.slot.onchange = () => { const s2 = MEAL_SLOTS.find((x) => x[0] === f.elements.slot.value); if (s2 && s2[2] && !S.meals.some((x) => x.id === m.id) && f.elements.date.value !== today()) f.elements.time.value = s2[2]; };
    f.onsubmit = (e) => {
      e.preventDefault();
      const n = { id: m.id, date: f.elements.date.value || today(), slot: f.elements.slot.value, label: f.elements.label.value.trim(), time: f.elements.time.value, text: f.elements.text.value.trim(), protein: f.elements.protein.value === '' ? '' : Math.max(0, +f.elements.protein.value), at: m.at || Date.now(), updated: Date.now() };
      if (!n.text) { toast('Write or say what you ate.'); return; }
      S.meals = S.meals.filter((x) => x.id !== n.id).concat([n]); save(); d.close(); foodDay = n.date; refresh();
      showCoachCard(afterOffice(n) ? 'Logged. After-office eating is the biggest lever on your weight: next time, a bigger dinner at the office break.' : 'Logged. Writing it down is half of eating well.');
      checkProgress();
    };
    const del = d.querySelector('#ml-del'); if (del) del.onclick = () => { S.meals = S.meals.filter((x) => x.id !== m.id); save(); d.close(); refresh(); };
    d.showModal();
  }
  function foodDiary() {
    foodDay = foodDay || today(); const list = mealsOn(foodDay);
    const prot = list.reduce((a, m) => a + (+m.protein || 0), 0); const late = list.filter(afterOffice);
    const row = (m) => '<button class="meal" type="button" data-meal="' + m.id + '"><span class="m-t">' + esc(m.time || '—') + '</span><span class="m-b"><b>' + esc(m.label || slotName(m.slot)) + (afterOffice(m) ? ' <em class="late">after office</em>' : '') + '</b><span>' + esc(m.text) + '</span></span>' + (m.protein !== '' && m.protein !== undefined ? '<span class="m-p">' + m.protein + ' g</span>' : '') + '</button>';
    // one timeline: your entries, plus empty breakfast/lunch/dinner slots at their usual times
    const empties = ['breakfast', 'lunch', 'dinner'].filter((k) => !list.some((m) => m.slot === k)).map((k) => ({ empty: true, slot: k, time: MEAL_SLOTS.find((x) => x[0] === k)[2] }));
    const all = list.concat(empties).sort((x, y) => mealMin(x) - mealMin(y));
    const std = all.map((m) => (m.empty ? '<button class="meal empty" type="button" data-addmeal="' + m.slot + '"><span class="m-t">' + m.time + '</span><span class="m-b"><b>' + slotName(m.slot) + '</b><span>Tap to add</span></span></button>' : row(m))).join('');
    const extra = '';
    return '<div class="rep-head"><button class="btn small" data-fday="-1" type="button" aria-label="Previous day">‹</button><h3>' + esc(niceDate(foodDay)) + (foodDay === today() ? ' (today)' : '') + '</h3><button class="btn small" data-fday="1" type="button" aria-label="Next day"' + (foodDay >= today() ? ' disabled' : '') + '>›</button></div>' +
      '<div class="meals">' + std + extra + '</div>' +
      '<p class="actions" style="margin:12px 0 0"><button class="btn haldi" type="button" data-addmeal="">Add another entry</button></p>' +
      '<p class="small muted" style="margin:10px 0 0">' + list.length + ' entr' + (list.length === 1 ? 'y' : 'ies') + (prot ? ' · about ' + prot + ' g protein logged (aim 110–130 g)' : '') + (late.length ? ' · <b class="late-txt">' + late.length + ' after office</b>' : '') + '. Eating after midnight counts toward the day before.</p>';
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-meal]'); if (a) { e.preventDefault(); openMeal(a.dataset.meal); return; }
    const b = e.target.closest('[data-addmeal]'); if (b) { e.preventDefault(); openMeal(null, b.dataset.addmeal || 'snack', foodDay || today()); return; }
    const c = e.target.closest('[data-fday]'); if (c) { e.preventDefault(); foodDay = addDays(foodDay || today(), +c.dataset.fday); if (foodDay > today()) foodDay = today(); const el = document.getElementById('food'); if (el) el.innerHTML = foodDiary(); }
  });

  // ---------- private access: a PIN, asked once per device ----------
  // Change the PIN: node -e "let h=0x811c9dc5;for(const c of 'dataleap-lock::NEWPIN'){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0}console.log(h.toString(16))"
  const LOCK_HASH = '87b5415';
  const LOCK_KEY = 'dataleap:unlocked';
  const lockHash = (pin) => { let h = 0x811c9dc5; for (const c of 'dataleap-lock::' + pin) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  function isUnlocked() { return kvGet(LOCK_KEY) === LOCK_HASH; }
  function showLock() {
    document.body.classList.add('locked');
    const box = document.createElement('div'); box.className = 'lock';
    box.innerHTML = '<div class="lock-in"><span class="brand-mark big" aria-hidden="true">' + MARK + '</span><h1>DataLeap</h1><p class="muted">Private app. Enter the PIN you were given.</p>' +
      '<div class="pin" id="pin" aria-live="polite">' + '<i></i>'.repeat(6) + '</div><p class="pin-err" id="pinerr" role="alert"></p>' +
      '<div class="pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k) => k === '' ? '<span></span>' : '<button type="button" data-k="' + k + '">' + k + '</button>').join('') + '</div>' +
      '<a class="lock-priv" href="privacy.html">Privacy policy</a></div>';
    document.body.appendChild(box);
    let pin = '';
    const draw = () => { box.querySelectorAll('#pin i').forEach((d, i) => d.classList.toggle('on', i < pin.length)); };
    const press = (k) => {
      if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 6) pin += k;
      draw();
      if (pin.length === 6) {
        if (lockHash(pin) === LOCK_HASH) { kvSet(LOCK_KEY, LOCK_HASH); location.reload(); }
        else { const p2 = box.querySelector('#pin'); p2.classList.remove('shake'); void p2.offsetWidth; p2.classList.add('shake'); box.querySelector('#pinerr').textContent = 'That PIN is not right.'; setTimeout(() => { pin = ''; draw(); }, 400); }
      }
    };
    box.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => press(b.dataset.k); });
    document.addEventListener('keydown', (e) => { if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') press('⌫'); });
  }

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
        sdNext: sd ? sd.item.title : '', dsaNext: ds ? ds.item.title : '', dayStart: S.settings.dayStart, min: minNow(), name: isSelf() ? '' : who(), pron: pron(), self: isSelf(), weekMin, weekComplete, streak: streak(),
        me: me(), why: (S.profile.why || '').trim(), plan: latestPlan() || '', sdMin: targets(t).sd, dsaMin: targets(t).dsa, skipDays: skipCostDays(),
        sleepAt: ampm(toMin(life().sleep, 30)), sdAt: (() => { const b = buildPlan().weekday.find((x) => x.kind === 'sd'); return b ? ampm(b.s) : ''; })(),
        herAgeAtOffer: herAgeAtOffer(), offerDate: S.profile.targetDate || '',
        gymDay: isGymDay(t), gymDone: gymDone(t), workout: fit().on ? workoutFor(t).name : '', kgNow: weightNow(), goalKg: fit().goalKg, fitOn: fit().on }));
      const mo = JSON.stringify(S.settings.motiv); if (mo !== lastMo) { lastMo = mo; if (BR.setMotivation) BR.setMotivation(mo); }
      const r = JSON.stringify(S.reminders); if (r !== lastRem) { lastRem = r; BR.setReminders(r); }
      const qo = {}; Object.keys(D.quotes).forEach((k) => { qo[k] = D.quotes[famCat(k)].map(personal); });
      const q = JSON.stringify(qo); if (q !== lastQ) { lastQ = q; BR.setQuotes(q); }
    } catch (e) {}
  }

  // ---------- boot ----------
  const page = document.body.dataset.page;
  if (page !== 'privacy' && !isUnlocked()) { showLock(); return; }
  checkProgress();
  renderChrome();
  // First run on a new phone: the two-minute setup comes first.
  if (!S.setupDone && page !== 'setup' && page !== 'privacy') { location.replace('setup.html'); return; }
  if (S.planApplied && (S.planVersion || 1) < 4) {
    const wasV1 = (S.planVersion || 1) < 2;
    applyPlan(true);
    if (wasV1) setTimeout(() => showCoachCard('New: after office I’ll tell you to put the phone down, and a silent check after your bedtime asks if you’re still scrolling. Sleep protects your morning deep work.'), 1500);
  }
  if (!S.planApplied && S.setupDone) {
    applyPlan(true);
    setTimeout(() => showCoachCard('I’ve planned your day around your ' + ampm(toMin(life().officeStart, 570)) + ' to ' + ampm(toMin(life().officeEnd, 1110)) + ' office shift. Tap to see it.', () => { location.href = 'plan.html'; }), 1500);
  }
  if (page !== 'setup') setTimeout(bedtimeCheck, 600);
  if (page === 'setup') initSetup();
  if (page === 'home') initHome();
  else if (page === 'dsa') initList('dsa');
  else if (page === 'sd') initList('sd');
  else if (page === 'progress') initProgress();
  else if (page === 'settings') initSettings();
  else if (page === 'why') initWhy();
  else if (page === 'lib') initLib();
  else if (page === 'plan') initPlan();
  else if (page === 'career') initCareer();
  else if (page === 'fit') initFit();
  tick();
  setInterval(() => { tick(); updateCountdown(); }, 1000);
  setInterval(checkReminders, 20000);
  checkReminders();
  if (!BR) window.addEventListener('storage', () => { S = load(); refresh(); tick(); });
  window.dlResume = () => { S = loadBest(); refresh(); tick(); checkProgress(); syncNative(); if (window.dlSettingsRedraw) window.dlSettingsRedraw(); if (window.dlVoiceResume) window.dlVoiceResume(); };
  syncNative();
})();
