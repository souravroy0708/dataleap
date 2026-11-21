/* DataLeap static prototype. All data stays in this browser (localStorage).
   Export from Progress to back up; the Django + Android version replaces this storage with the API. */
(function () {
  const D = window.DL_DATA;
  const LIB = window.DL_LIB || { groups: [], lessons: [] };
  const LIB_PRIO = { L1: 1, L2: 1, L3: 1, L4: 1, L5: 1, L6: 2, L7: 3 };
  const TIER = { must: 'Must do', useful: 'Useful', skip: 'Skip unless time', sql: 'SQL round' };
  LIB.lessons.forEach((l) => D.items.push({
    id: l.id, track: l.g === 'L7' ? 'sql' : 'sd', topic: l.g, title: l.t, type: l.kind === 'case' ? 'libcase' : 'lesson', lib: true, tier: l.tier,
    links: [{ p: 'Aced', url: l.u }].concat(l.sol ? [{ p: 'Solution', url: l.u + '?tab=solution' }] : []),
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
    settings: { levelMode: 'auto', level: 1, levelSince: ymd(new Date(Date.now() - 4 * 3600e3)), manual: { sd: 30, dsa: 25, min: 10 }, weekendX: 1.5, dayStart: 4, restPerWeek: 1 },
    profile: {
      name: '', why: '', role: 'Staff Data Engineer', companies: 'Google, Uber, Visa', targetDate: '2027-09-30', hoursGoal: 250,
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
    s.profile = Object.assign(defaults().profile, raw.profile || {});
    s.profile.vision = Object.assign(defaults().profile.vision, (raw.profile || {}).vision || {});
    s.hit = s.hit || {}; s.fired = s.fired || {};
    return s;
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save: browser storage is full or blocked.'); } };
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
    const s = streak();
    const hits = Object.keys(D.milestones).map(Number).filter((m) => m <= s && !S.hit[m]);
    if (hits.length) {
      hits.forEach((m) => { S.hit[m] = 1; }); save();
      const m = Math.max(...hits);
      celebrate(m + '-day streak', personal(D.milestones[m]));
    }
    if (S.settings.levelMode === 'auto' && S.settings.level < 4) {
      const lv = L();
      if (completeSince(S.settings.levelSince) >= lv.need) {
        S.settings.level += 1; S.settings.levelSince = today(); save();
        const nl = L();
        celebrate('Level ' + nl.n + ' unlocked: ' + nl.name, 'Targets are now system design ' + nl.sd + ' min and DSA ' + nl.dsa + ' min a day.');
      }
    }
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
    const concepts = () => {
      for (const code of D.sdCurriculum) {
        const ip = D.items.find((i) => i.topic === code && st(i.id).status === 'in_progress');
        if (ip) return ip;
        const it = D.items.find((i) => i.topic === code && st(i.id).status === 'not_started');
        if (it) return it;
      }
      return null;
    };
    const cases = () => D.items.find((i) => i.type === 'case' && st(i.id).status === 'in_progress') || D.items.find((i) => i.type === 'case' && st(i.id).status === 'not_started');
    const fromLib = (pred) => { const ls = D.items.filter((i) => i.lib && i.track === 'sd' && i.tier === 'must' && pred(i)); return ls.find((i) => st(i.id).status === 'in_progress') || ls.find((i) => st(i.id).status === 'not_started'); };
    const odd = daysBetween('2026-01-01', today()) % 2 === 1;
    if (lv.sdMode === 'concept') {
      const c = concepts(); const l = fromLib((i) => i.type === 'lesson' || i.topic === 'L2');
      const pick = (odd && c) ? c : (l || c || cases());
      if (!pick) return null;
      return pick.lib ? { item: pick, why: 'Course lesson', how: 'Open it on Aced and study it for ' + targets(today()).sd + ' minutes, then write a 5-line summary here.' } : { item: pick, why: 'Next concept', how: lv.sdHow };
    }
    const k = cases(); const lk = fromLib((i) => i.type === 'libcase');
    const c = (odd && lk) ? lk : (k || lk || concepts());
    if (!c) return null;
    const isCase = c.type === 'case' || c.type === 'libcase';
    const part = isCase && lv.sdMode === 'case-part' ? nextPart(c.id) : null;
    const how = c.lib ? (part ? 'Try the ' + part.toLowerCase() + ' part yourself first, then compare with the lesson on Aced.' : 'Attempt it in 45 to 60 minutes before opening the lesson, then score it with the rubric.') : (part ? 'Today\'s part: ' + part + '. ' + lv.sdHow : lv.sdHow);
    return { item: c, why: c.lib ? 'Course design case' : isCase ? 'Design case' : 'Next concept', how, part };
  }

  // ---------- quotes ----------
  const PAGE_QUOTES = { home: ['habit', 'family'], lib: ['habit', 'sd'], sd: ['sd'], dsa: ['dsa'], roadmap: ['habit', 'sd'], why: ['family'], progress: ['habit'], settings: ['habit'], companies: ['sd'] };
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
  const NAV = [['index.html', 'Today'], ['system-design.html', 'System design'], ['dsa.html', 'DSA'], ['library.html', 'Library'], ['roadmap.html', 'Roadmap'], ['why.html', 'My why'], ['companies.html', 'Companies'], ['progress.html', 'Progress'], ['settings.html', 'Reminders']];
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
    foot.innerHTML = '<div class="wrap">Your progress is stored only in this browser. Back it up from <a href="progress.html">Progress</a>. Practice happens on NeetCode and the linked videos; DataLeap keeps your time, status, notes and streak.</div>';
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
    const base = page === 'sd' ? ['sd', 'family'] : page === 'dsa' ? ['dsa', 'family'] : ['habit', 'family', 'sd'];
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }
  function notify(title, body, url, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const opts = { body, tag: tag || 'dataleap', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', data: { url: url || 'index.html' } };
    if (swReg && swReg.showNotification) { swReg.showNotification(title, opts); return true; }
    try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); location.href = url || 'index.html'; }; return true; } catch (e) { return false; }
  }

  // ---------- timer ----------
  const getT = () => { try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { return null; } };
  const setT = (t) => { if (t) localStorage.setItem(TKEY, JSON.stringify(t)); else localStorage.removeItem(TKEY); };
  const elapsed = (t) => (t ? t.acc + (t.paused ? 0 : Date.now() - t.start) : 0);
  const clock = (ms) => { const s = Math.floor(ms / 1000); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
  function startTimer(track, itemId, opts) {
    opts = opts || {};
    if (getT()) { toast('A timer is already running. Stop it first.'); return; }
    const info = dayInfo(today()); const tg = targets(today())[track];
    const goalMs = Math.max(minNow(), tg - (track === 'dsa' ? info.dsa : info.sd)) * 60000;
    setT({ track, itemId: itemId || null, start: Date.now(), acc: 0, paused: false, goalMs, told: false, part: opts.part || '' });
    const it = byId[itemId];
    if (it && it.links[0] && !opts.noOpen) window.open(it.links[0].url, '_blank', 'noopener');
    tick(); refresh();
    toast('Timer started' + (it ? ' for ' + it.title : '') + '. Target ' + Math.round(goalMs / 60000) + ' min.');
  }
  function pauseTimer() { const t = getT(); if (!t) return; if (t.paused) { t.start = Date.now(); t.paused = false; } else { t.acc = elapsed(t); t.paused = true; } setT(t); tick(); }
  function stopTimer() { const t = getT(); if (!t) return; openLog({ track: t.track, itemId: t.itemId, minutes: Math.max(1, Math.round(elapsed(t) / 60000)), fromTimer: true, part: t.part }); }
  function tick() {
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
          '<span class="small muted" style="display:block">' + pct + '% of today\'s target</span></span>' +
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
      '<div class="links">' + it.links.map((l) => '<a class="btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open on ' + esc(l.p) + '</a>').join('') + (it.premium ? '<span class="chip">Premium</span>' : '') + videoLink + '</div>' +
      ((it.text || it.followUps || it.angle) ? '<div class="prompt">' + (it.text ? '<p style="margin:0">' + esc(it.text) + '</p>' : '') + (it.angle ? '<p class="muted small" style="margin:.3rem 0 0">Data engineering angle: ' + esc(it.angle) + '</p>' : '') +
        (it.followUps ? '<p style="margin:.6rem 0 0"><b>Interviewer follow-ups</b></p><ul>' + it.followUps.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') + '</div>' : '') +
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
    if (after === 'ok' && before !== 'ok') { toast('Today is complete. Both tasks done.'); releaseBalloons(7, ['family'], true); }
    else toast('Logged ' + minutes + ' min.' + (minutes < minNow() ? ' Under the ' + minNow() + '-minute minimum, so it doesn\'t complete the task yet.' : ''));
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
    return (n ? '<p class="why-for">For ' + esc(n) + '</p>' : '<span class="kicker"><span class="dot"></span>Staff data engineer, 2027</span>') +
      '<p class="why-text">' + (p.why ? esc(p.why) : '<a href="why.html">Write your why.</a> Her name, and what this job changes for her.') + '</p>' +
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
    document.getElementById('why').innerHTML = whyStrip() + levelCard();
    const late = new Date().getHours() >= 21 && info.status !== 'ok' && !S.rest.includes(t);
    let banner = '';
    if (missedYesterday()) banner = '<div class="banner"><b>Never miss twice.</b> Yesterday slipped, and that is fine. Do the ' + minNow() + '-minute version of each task today and the habit stays alive.</div>';
    else if (late) banner = '<div class="banner"><b>Late, but not too late.</b> ' + minNow() + ' minutes on whatever is left still completes today.</div>';
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
      out += '<section class="topic"><div class="topic-head"><h2><span class="code">' + t.code + '</span>' + esc(t.name) + '</h2><div class="topic-meta"><span class="prio">P' + t.priority + '</span><span>' + doneN + ' of ' + all.length + ' done</span><span>' + fmtH(mins) + '</span></div></div><p class="topic-why">' + esc(t.why) + '</p><table class="qtable"><tbody>' +
        rows.map((i) => {
          const s = st(i.id);
          const src = i.links.length ? i.links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.p) + '</a>').join(' ') : (i.track === 'sd' ? '<a href="https://www.youtube.com/results?search_query=' + encodeURIComponent(i.title + ' data engineering system design') + '" target="_blank" rel="noopener">Find a video</a>' : '<span class="muted">Question only</span>');
          const sc = (s.scores || []).length ? ' <span class="chip">' + s.scores[s.scores.length - 1].total + '/14</span>' : '';
          return '<tr><td class="t"><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (i.angle ? '<span class="angle">' + esc(i.angle) + '</span>' : '') + (i.fits && i.fits.length ? '<span class="angle fits">Fits: ' + i.fits.join(', ') + '</span>' : '') + '</td>' +
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
          '<td class="hide-sm"><span class="tier tier-' + i.tier + '">' + TIER[i.tier] + '</span></td><td class="src">' + i.links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + (l.p === 'Aced' ? 'Open' : esc(l.p)) + '</a>').join(' · ') + '</td>' +
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
    document.getElementById('split').innerHTML = '<p class="small muted">This week: system design ' + fmtH(ws) + ', DSA ' + fmtH(wd) + '. Aim for about 60% system design.</p><div class="splitbar" role="img" aria-label="System design ' + Math.round((ws / tot) * 100) + ' percent"><span class="a" style="width:' + (ws / tot) * 100 + '%"></span><span class="b" style="width:' + (wd / tot) * 100 + '%"></span></div>';
    drawGrid(16);
    document.getElementById('topics').innerHTML = '<table class="dtable"><thead><tr><th>Topic</th><th class="num">Items</th><th class="num">Done</th><th class="num">Due</th><th class="num">Time</th></tr></thead><tbody>' +
      topics.map((tp) => { const its = D.items.filter((i) => i.topic === tp.code); const mins = its.reduce((a, i) => a + minutesFor(i.id), 0); return '<tr><td>' + tp.code + ' ' + esc(tp.name) + ' <span class="muted small">P' + tp.priority + '</span></td><td class="num">' + its.length + '</td><td class="num">' + its.filter((i) => ['solved', 'done', 'mastered'].includes(st(i.id).status)).length + '</td><td class="num">' + its.filter((i) => isDue(i.id)).length + '</td><td class="num">' + (mins ? fmtH(mins) : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    const recent = S.sessions.slice().sort((a, b) => b.at - a.at).slice(0, 40);
    document.getElementById('sessions').innerHTML = recent.length ? '<table class="dtable"><thead><tr><th>Day</th><th>Track</th><th>Item</th><th>Activity</th><th class="num">Minutes</th><th></th></tr></thead><tbody>' +
      recent.map((s) => '<tr><td>' + s.date + '</td><td>' + TRACK[s.track] + '</td><td>' + (byId[s.itemId] ? '<button class="linkish" data-open="' + s.itemId + '">' + esc(byId[s.itemId].title) + '</button>' : '<span class="muted">—</span>') + (s.part ? ' <span class="muted small">(' + esc(s.part) + ')</span>' : '') + '</td><td>' + esc((ACTIVITY[s.track].find((a) => a[0] === s.activity) || ['', s.activity])[1]) + '</td><td class="num">' + s.minutes + '</td><td><button class="linkish small" data-delsess="' + s.id + '">Delete</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted">No sessions yet. Start a timer on <a href="index.html">Today</a> or log time manually.</p>';
  }
  function initProgress() {
    refresh = renderProgress; renderProgress();
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-delsess]'); if (b && confirm('Delete this session?')) { S.sessions = S.sessions.filter((s) => s.id !== b.dataset.delsess); save(); renderProgress(); } });
    document.getElementById('export').onclick = () => { const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dataleap-backup-' + today() + '.json'; a.click(); };
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
    ['name', 'why', 'role', 'companies', 'targetDate', 'hoursGoal', 'letter'].forEach((k) => { f.elements[k].value = p[k] || ''; });
    ['daughter', 'family', 'me'].forEach((k) => { f.elements['v-' + k].value = (p.vision[k] || []).join('\n'); });
    f.onsubmit = (e) => {
      e.preventDefault();
      ['name', 'why', 'role', 'companies', 'targetDate', 'letter'].forEach((k) => { p[k] = f.elements[k].value.trim(); });
      p.hoursGoal = Math.max(10, parseInt(f.elements.hoursGoal.value, 10) || 250);
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
    const FOCUS = { either: 'Either', dsa: 'DSA', sd: 'System design' };
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
      if (S.reminders.length >= 6) { toast('Up to 6 reminders a day. Delete one first.'); return; }
      const days = [...rf.querySelectorAll('input[name=day]:checked')].map((x) => +x.value);
      if (!days.length) { toast('Pick at least one day.'); return; }
      S.reminders.push({ id: 'r' + Date.now(), time: rf.elements.time.value, days, focus: rf.elements.focus.value, msg: rf.elements.msg.value.trim() || 'Time to prep', skip: rf.elements.skip.checked, last: rf.elements.last.checked, on: true });
      save(); renderRem(); rf.reset(); toast('Reminder added');
    };
    const pb = document.getElementById('perm'); const ps = document.getElementById('permstate'); const tb = document.getElementById('testnote');
    const showPerm = () => {
      const has = 'Notification' in window;
      ps.textContent = !has ? 'This browser does not support notifications. Use the calendar option.' : Notification.permission === 'granted' ? 'Notifications are on.' : Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in the browser\'s site settings for this site.' : 'Notifications are off.';
      pb.hidden = !has || Notification.permission !== 'default'; tb.hidden = !has || Notification.permission !== 'granted';
    };
    pb.onclick = () => Notification.requestPermission().then(showPerm);
    tb.onclick = () => { if (!notify('DataLeap', 'Test reminder. ' + randomQuote('family'), 'index.html', 'dl-test')) toast('Could not show a notification in this browser.'); };
    showPerm();
    document.getElementById('ics').onclick = () => {
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
    lf.elements.weekendX.value = S.settings.weekendX; lf.elements.dayStart.value = S.settings.dayStart; lf.elements.restPerWeek.value = S.settings.restPerWeek;
    lf.onsubmit = (e) => {
      e.preventDefault();
      const nl = +lf.elements.level.value; if (nl !== S.settings.level) { S.settings.level = nl; S.settings.levelSince = today(); }
      S.settings.levelMode = lf.elements.mode.value;
      S.settings.manual = { sd: +lf.elements.msd.value || 30, dsa: +lf.elements.mdsa.value || 25, min: Math.max(1, +lf.elements.mmin.value || 10) };
      S.settings.weekendX = Math.max(1, +lf.elements.weekendX.value || 1.5);
      S.settings.dayStart = Math.min(23, Math.max(0, +lf.elements.dayStart.value || 0));
      S.settings.restPerWeek = Math.min(3, Math.max(0, +lf.elements.restPerWeek.value));
      save(); toast('Saved');
    };
    document.getElementById('reset').onclick = () => { if (confirm('Delete all progress, notes and settings in this browser? Export a backup first if you need it.')) { localStorage.removeItem(KEY); localStorage.removeItem(TKEY); location.reload(); } };
  }

  // ---------- reminders (fire while any DataLeap tab is open) ----------
  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(); const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const t = today(); const info = dayInfo(t);
    S.reminders.forEach((r) => {
      if (!r.on || r.time !== hm || !r.days.includes(now.getDay())) return;
      const k = t + r.id; if (S.fired[k]) return;
      if (S.rest.includes(t) || info.status === 'ok') return;
      if (r.skip && ((r.focus === 'dsa' && info.dsaDone) || (r.focus === 'sd' && info.sdDone))) return;
      S.fired[k] = 1; save();
      const track = r.focus === 'either' ? (info.sdDone ? 'dsa' : 'sd') : r.focus;
      const sug = suggest(track);
      const body = r.msg + (sug ? '\nToday: ' + sug.item.title : '') + '\n' + randomQuote(missedYesterday() ? 'comeback' : (now.getHours() >= 20 ? 'family' : track));
      notify(r.last ? 'Last call' : 'DataLeap', body, 'index.html?start=' + track, 'dl-rem-' + r.id);
    });
  }

  // ---------- boot ----------
  checkProgress();
  renderChrome();
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  else if (page === 'dsa') initList('dsa');
  else if (page === 'sd') initList('sd');
  else if (page === 'progress') initProgress();
  else if (page === 'settings') initSettings();
  else if (page === 'why') initWhy();
  else if (page === 'lib') initLib();
  tick();
  setInterval(tick, 1000);
  setInterval(checkReminders, 20000);
  checkReminders();
  window.addEventListener('storage', () => { S = load(); refresh(); tick(); });
})();
