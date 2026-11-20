/* DataLeap static prototype. All data stays in this browser (localStorage).
   Export from Progress to back up; the Django + Android version replaces this storage with the API. */
(function () {
  const D = window.DL_DATA;
  const KEY = 'dataleap:v1';
  const TKEY = 'dataleap:timer';
  const byId = Object.fromEntries(D.items.map((i) => [i.id, i]));
  const topics = [...D.dsaTopics.map((t) => ({ ...t, track: 'dsa' })), ...D.sdTopics.map((t) => ({ ...t, track: 'sd' }))];
  const topicBy = Object.fromEntries(topics.map((t) => [t.code, t]));

  const STATUS = {
    dsa: [['not_started', 'Not started'], ['not_solved', 'Not solved'], ['with_help', 'Solved with help'], ['solved', 'Solved on my own'], ['revise', 'Revise'], ['mastered', 'Mastered']],
    sd: [['not_started', 'Not started'], ['in_progress', 'In progress'], ['done', 'Done'], ['revise', 'Revise'], ['mastered', 'Mastered']]
  };
  const STATUS_LABEL = Object.fromEntries([...STATUS.dsa, ...STATUS.sd]);
  const ACTIVITY = {
    dsa: [['solve', 'Solve'], ['revise', 'Revise']],
    sd: [['practise', 'Practise a part'], ['watch', 'Watch a video'], ['summarise', 'Summarise'], ['read', 'Read a concept'], ['revise', 'Revise']]
  };
  const PARTS = ['Requirements', 'Scale estimates', 'High-level architecture', 'Storage and data model', 'Processing (batch/stream)', 'Failures and backfills', 'Data quality', 'Trade-offs'];
  const NOTE_TYPES = ['Approach', 'Mistake', 'Key insight', 'Summary', 'Interview follow-up'];

  // ---------- storage ----------
  const defaults = () => ({
    items: {},
    sessions: [],
    rest: [],
    settings: { dsaWeekday: 45, sdWeekday: 30, dsaWeekend: 60, sdWeekend: 60, minSession: 10, dayStart: 4, restPerWeek: 1 },
    reminders: [
      { id: 'r1', time: '07:00', days: [1, 2, 3, 4, 5], focus: 'either', msg: 'Plan today: one DSA, one system design unit', skip: true, last: false, on: true },
      { id: 'r2', time: '13:30', days: [1, 2, 3, 4, 5], focus: 'sd', msg: 'Lunch break: one system design video or summary', skip: true, last: false, on: true },
      { id: 'r3', time: '21:00', days: [0, 1, 2, 3, 4, 5, 6], focus: 'dsa', msg: 'DSA slot: one question', skip: true, last: false, on: true },
      { id: 'r4', time: '22:30', days: [0, 1, 2, 3, 4, 5, 6], focus: 'either', msg: 'Last call: 20 minutes keeps the streak', skip: true, last: true, on: true }
    ],
    fired: {}
  });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = defaults(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save: browser storage is full or blocked.'); } };
  const st = (id) => S.items[id] || { status: 'not_started', notes: [], next: null, solvedCount: 0, pinned: null };

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const studyDate = (ts) => ymd(new Date(ts - S.settings.dayStart * 3600e3));
  const today = () => studyDate(Date.now());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return ymd(x); };
  const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
  const niceDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtH = (m) => (m >= 60 ? (m / 60).toFixed(1) + ' h' : m + ' min');

  // ---------- day logic ----------
  function targets(date) {
    const w = dow(date) === 0 || dow(date) === 6;
    return { dsa: w ? S.settings.dsaWeekend : S.settings.dsaWeekday, sd: w ? S.settings.sdWeekend : S.settings.sdWeekday };
  }
  function dayInfo(date) {
    const ss = S.sessions.filter((s) => s.date === date);
    const sum = (t) => ss.filter((s) => s.track === t).reduce((a, s) => a + s.minutes, 0);
    const counted = (t) => ss.some((s) => s.track === t && s.minutes >= S.settings.minSession);
    const dsa = sum('dsa'), sd = sum('sd');
    const dsaDone = counted('dsa'), sdDone = counted('sd');
    let status = 'miss';
    if (dsaDone && sdDone) status = 'ok';
    else if (S.rest.includes(date)) status = 'rest';
    else if (dsa + sd > 0) status = 'part';
    return { dsa, sd, dsaDone, sdDone, status };
  }
  function streak() {
    let d = today();
    if (dayInfo(d).status !== 'ok' && !S.rest.includes(d)) d = addDays(d, -1);
    let n = 0;
    for (let i = 0; i < 1000; i++) {
      const s = dayInfo(d).status;
      if (s === 'ok') n++;
      else if (s !== 'rest') break;
      d = addDays(d, -1);
    }
    return n;
  }
  function restUsedThisWeek() {
    const t = today(); const start = addDays(t, -((dow(t) + 6) % 7));
    return S.rest.filter((r) => r >= start && r <= t).length;
  }

  // ---------- status and revision ----------
  function setStatus(id, status) {
    const s = st(id);
    const prev = s.status;
    s.status = status;
    const t = today();
    if (status === 'solved') {
      s.solvedCount = (s.solvedCount || 0) + 1;
      if (s.solvedCount >= 3) { s.status = 'mastered'; s.next = null; }
      else s.next = addDays(t, [7, 14, 30][s.solvedCount - 1]);
    } else {
      if (status === 'not_solved') s.solvedCount = 0;
      const gap = { not_solved: 1, with_help: 3, revise: 2, in_progress: 1, done: 14 }[status];
      s.next = gap ? addDays(t, gap) : null;
    }
    s.history = s.history || [];
    if (prev !== s.status) s.history.push({ from: prev, to: s.status, at: Date.now() });
    S.items[id] = s;
    save();
  }
  const isDue = (id) => { const s = S.items[id]; return !!(s && s.next && s.next <= today() && !['not_started', 'mastered'].includes(s.status)); };
  const dueItems = (track) => D.items.filter((i) => (!track || i.track === track) && isDue(i.id));
  function minutesFor(id) { return S.sessions.filter((s) => s.itemId === id).reduce((a, s) => a + s.minutes, 0); }

  function suggest(track) {
    const due = dueItems(track);
    if (due.length) return { item: due[0], why: 'Due for revision' };
    if (track === 'sd') {
      const ip = D.items.find((i) => i.track === 'sd' && st(i.id).status === 'in_progress');
      if (ip) return { item: ip, why: 'Continue' };
    }
    const order = (track === 'dsa' ? D.dsaTopics : D.sdTopics).slice().sort((a, b) => a.priority - b.priority);
    const weekAgo = addDays(today(), -6);
    const weekMin = (code) => S.sessions.filter((s) => s.date >= weekAgo && byId[s.itemId] && byId[s.itemId].topic === code).reduce((a, s) => a + s.minutes, 0);
    const cands = [];
    order.forEach((t, idx) => {
      const it = D.items.find((i) => i.topic === t.code && st(i.id).status === 'not_started');
      if (it) cands.push({ it, p: t.priority, w: weekMin(t.code), idx });
    });
    cands.sort((a, b) => a.p - b.p || a.w - b.w || a.idx - b.idx);
    return cands.length ? { item: cands[0].it, why: 'Next new' } : null;
  }

  // ---------- chrome ----------
  const NAV = [['index.html', 'Today'], ['dsa.html', 'DSA'], ['system-design.html', 'System design'], ['roadmap.html', 'Roadmap'], ['companies.html', 'Companies'], ['progress.html', 'Progress'], ['settings.html', 'Reminders and goal']];
  function renderChrome() {
    const here = (location.pathname.split('/').pop() || 'index.html');
    const head = document.getElementById('top');
    if (head) {
      head.className = 'topbar';
      head.innerHTML = '<div class="inner"><a class="brand" href="index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="7" height="6" rx="1.5" fill="currentColor"/><rect x="15" y="9" width="7" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12h6" stroke="currentColor" stroke-width="2"/></svg>DataLeap</a><nav class="nav" aria-label="Main">' +
        NAV.map(([h, l]) => '<a href="' + h + '"' + (h === here ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') +
        '</nav><a class="timer-chip" id="timerchip" href="index.html"></a></div>';
    }
    const foot = document.createElement('footer');
    foot.className = 'site';
    foot.innerHTML = 'Your progress is stored only in this browser. Back it up from <a href="progress.html">Progress</a>. Practice happens on the linked platforms; DataLeap tracks time, status and notes.';
    document.body.appendChild(foot);
    const t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t);
    document.body.insertAdjacentHTML('beforeend', itemDialogHTML() + logDialogHTML());
  }
  let toastT;
  function toast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

  // ---------- timer ----------
  const getT = () => { try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { return null; } };
  const setT = (t) => { if (t) localStorage.setItem(TKEY, JSON.stringify(t)); else localStorage.removeItem(TKEY); };
  const elapsed = (t) => t ? t.acc + (t.paused ? 0 : Date.now() - t.start) : 0;
  const clock = (ms) => { const s = Math.floor(ms / 1000); return (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
  function startTimer(track, itemId) {
    const cur = getT();
    if (cur) { toast('A timer is already running. Stop it first.'); return; }
    setT({ track, itemId: itemId || null, start: Date.now(), acc: 0, paused: false });
    tick();
    const it = byId[itemId];
    if (it && it.links[0]) window.open(it.links[0].url, '_blank', 'noopener');
    if (document.body.dataset.page === 'home') renderHome();
    toast('Timer started' + (it ? ' for ' + it.title : ''));
  }
  function pauseTimer() { const t = getT(); if (!t) return; if (t.paused) { t.start = Date.now(); t.paused = false; } else { t.acc = elapsed(t); t.paused = true; } setT(t); tick(); }
  function stopTimer() { const t = getT(); if (!t) return; const mins = Math.max(1, Math.round(elapsed(t) / 60000)); openLog({ track: t.track, itemId: t.itemId, minutes: mins, fromTimer: true }); }
  function tick() {
    const t = getT();
    const chip = document.getElementById('timerchip');
    if (chip) { chip.classList.toggle('on', !!t); chip.textContent = t ? (t.track === 'dsa' ? 'DSA ' : 'System design ') + clock(elapsed(t)) + (t.paused ? ' (paused)' : '') : ''; }
    const bar = document.getElementById('timerbar');
    if (bar) {
      bar.classList.toggle('on', !!t);
      if (t) {
        const it = byId[t.itemId];
        bar.innerHTML = '<span class="clock">' + clock(elapsed(t)) + '</span><span>' + (t.track === 'dsa' ? 'DSA' : 'System design') + (it ? ': <button class="linkish" data-open="' + it.id + '">' + esc(it.title) + '</button>' : '') + (t.paused ? ' <span class="muted">(paused)</span>' : '') + '</span>' +
          '<span class="actions" style="margin:0 0 0 auto"><button class="btn" data-act="pause">' + (t.paused ? 'Resume' : 'Pause') + '</button><button class="btn primary" data-act="stop">Stop and log</button></span>';
      }
    }
  }

  // ---------- item dialog ----------
  function itemDialogHTML() {
    return '<dialog id="itemdlg" aria-labelledby="itemdlg-title"><div class="dlg" id="itemdlg-body"></div></dialog>';
  }
  function openItem(id) {
    const it = byId[id]; if (!it) return;
    const s = st(id); const tp = topicBy[it.topic];
    const opts = STATUS[it.track].map(([v, l]) => '<option value="' + v + '"' + (v === s.status ? ' selected' : '') + '>' + l + '</option>').join('');
    const notes = (s.notes || []).slice().sort((a, b) => (b.id === s.pinned) - (a.id === s.pinned) || b.at - a.at);
    const body = document.getElementById('itemdlg-body');
    body.innerHTML =
      '<div class="dlg-head"><div><p class="muted small" style="margin:0">' + esc(tp.code + ' ' + tp.name) + (it.diff ? ' · <span class="diff ' + it.diff + '">' + it.diff + '</span>' : '') + (it.type === 'case' ? ' · Design case' : it.type === 'concept' ? ' · Concept' : '') + '</p><h2 id="itemdlg-title">' + esc(it.title) + '</h2></div><button class="btn quiet" data-close aria-label="Close">Close</button></div>' +
      '<div class="links">' + it.links.map((l) => '<a class="btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">Open on ' + esc(l.p) + '</a>').join('') +
      (it.premium ? '<span class="chip">Premium</span>' : '') +
      (it.track === 'sd' ? '<a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(it.title + ' data engineering system design') + '">Find a video</a>' : '') + '</div>' +
      ((it.text || it.followUps || it.angle) ? '<div class="prompt">' + (it.text ? '<p style="margin:0">' + esc(it.text) + '</p>' : '') + (it.angle ? '<p class="muted small" style="margin:.3rem 0 0">DE angle: ' + esc(it.angle) + '</p>' : '') +
        (it.followUps ? '<p style="margin:.6rem 0 0"><b>Interviewer follow-ups</b></p><ul>' + it.followUps.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul><p class="small muted" style="margin:.6rem 0 0">Practise in parts: ' + PARTS.join(', ') + '.</p>' : '') + '</div>' : '') +
      '<div class="stats"><span>Time spent <b>' + fmtH(minutesFor(id)) + '</b></span><span>Sessions <b>' + S.sessions.filter((x) => x.itemId === id).length + '</b></span><span>Next review <b>' + (s.next ? s.next : '—') + '</b></span></div>' +
      '<div class="row"><div class="field"><label for="dlg-status">Status</label><select id="dlg-status">' + opts + '</select></div><div class="field" style="flex:0 0 auto"><button class="btn primary" data-start-item="' + id + '">Start timer</button></div><div class="field" style="flex:0 0 auto"><button class="btn" data-log-item="' + id + '">Log time</button></div></div>' +
      '<h3 style="margin-top:.5rem">Notes</h3><form id="noteform"><div class="row"><div class="field" style="flex:0 0 180px"><label for="note-type">Type</label><select id="note-type">' + NOTE_TYPES.map((n) => '<option>' + n + '</option>').join('') + '</select></div></div><div class="field"><label for="note-body">Note</label><textarea id="note-body" placeholder="Approach, mistake, the one thing to remember next time"></textarea></div><button class="btn" type="submit">Add note</button></form>' +
      '<ul class="notes">' + (notes.length ? notes.map((n) => '<li class="' + (n.id === s.pinned ? 'pinned' : '') + '"><div class="meta"><span>' + esc(n.type) + '</span><span>' + new Date(n.at).toLocaleString() + '</span>' + (n.id === s.pinned ? '<span>Key note</span>' : '<button class="linkish small" data-pin="' + n.id + '">Pin as key note</button>') + '<button class="linkish small" data-delnote="' + n.id + '">Delete</button></div><div class="body">' + esc(n.body) + '</div></li>').join('') : '<li class="muted small" style="border:0;padding-left:0">No notes yet. After each attempt, write the approach and the one mistake you made.</li>') + '</ul>';
    const dlg = document.getElementById('itemdlg');
    dlg.dataset.id = id;
    body.querySelector('#dlg-status').addEventListener('change', (e) => { setStatus(id, e.target.value); openItem(id); refresh(); toast('Status saved'); });
    body.querySelector('#noteform').addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = body.querySelector('#note-body').value.trim(); if (!txt) return;
      const s2 = st(id); s2.notes = s2.notes || []; s2.notes.push({ id: 'n' + Date.now(), type: body.querySelector('#note-type').value, body: txt, at: Date.now() });
      S.items[id] = s2; save(); openItem(id); toast('Note added');
    });
    if (!dlg.open) dlg.showModal();
  }

  // ---------- log dialog ----------
  function logDialogHTML() {
    return '<dialog id="logdlg" aria-labelledby="logdlg-title"><form class="dlg" id="logform" method="dialog"></form></dialog>';
  }
  function itemOptions(track, sel) {
    return '<option value="">No specific item</option>' + (track === 'dsa' ? D.dsaTopics : D.sdTopics).map((t) => '<optgroup label="' + esc(t.code + ' ' + t.name) + '">' + D.items.filter((i) => i.topic === t.code).map((i) => '<option value="' + i.id + '"' + (i.id === sel ? ' selected' : '') + '>' + esc(i.title) + '</option>').join('') + '</optgroup>').join('');
  }
  function openLog(o) {
    const f = document.getElementById('logform');
    const track = o.track || 'dsa';
    const it = byId[o.itemId];
    const cur = it ? st(it.id).status : 'not_started';
    f.innerHTML = '<div class="dlg-head"><h2 id="logdlg-title">Log ' + (track === 'dsa' ? 'DSA' : 'system design') + ' time</h2><button class="btn quiet" type="button" data-close aria-label="Close">Close</button></div>' +
      '<div class="row"><div class="field"><label for="lg-track">Track</label><select id="lg-track"><option value="dsa"' + (track === 'dsa' ? ' selected' : '') + '>DSA</option><option value="sd"' + (track === 'sd' ? ' selected' : '') + '>System design</option></select></div><div class="field"><label for="lg-min">Minutes</label><input id="lg-min" type="number" min="1" max="600" value="' + (o.minutes || 30) + '" required></div><div class="field"><label for="lg-date">Study day</label><input id="lg-date" type="date" value="' + today() + '"></div></div>' +
      '<div class="field"><label for="lg-item">Question or topic</label><select id="lg-item">' + itemOptions(track, o.itemId) + '</select></div>' +
      '<div class="row"><div class="field"><label for="lg-act">What you did</label><select id="lg-act">' + ACTIVITY[track].map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('') + '</select></div><div class="field"><label for="lg-status">Status after this session</label><select id="lg-status">' + STATUS[track].map(([v, l]) => '<option value="' + v + '"' + (v === (cur === 'not_started' ? (track === 'dsa' ? 'solved' : 'in_progress') : cur) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
      (track === 'sd' ? '<div class="field"><label for="lg-part">Design part (for design cases)</label><select id="lg-part"><option value="">Not a design case</option>' + PARTS.map((p) => '<option>' + p + '</option>').join('') + '</select></div>' : '') +
      '<div class="field"><label for="lg-note">Note (optional)</label><textarea id="lg-note" placeholder="What worked, what you missed"></textarea></div>' +
      '<div class="actions"><button class="btn primary" type="submit" value="save">Save session</button>' + (o.fromTimer ? '<button class="btn" type="button" data-discard>Discard timer</button>' : '') + '</div>';
    f.dataset.fromTimer = o.fromTimer ? '1' : '';
    f.querySelector('#lg-track').addEventListener('change', (e) => openLog({ ...o, track: e.target.value, itemId: null, minutes: +f.querySelector('#lg-min').value }));
    f.querySelector('#lg-item').addEventListener('change', (e) => {
      const s2 = e.target.value ? st(e.target.value).status : 'not_started';
      if (s2 !== 'not_started') f.querySelector('#lg-status').value = s2;
    });
    const d = document.getElementById('logdlg');
    if (!d.open) d.showModal();
  }
  function saveLog(f) {
    const track = f.querySelector('#lg-track').value;
    const minutes = Math.max(1, Math.min(600, parseInt(f.querySelector('#lg-min').value, 10) || 0));
    const itemId = f.querySelector('#lg-item').value || null;
    const date = f.querySelector('#lg-date').value || today();
    const sess = { id: 's' + Date.now(), date, track, itemId, minutes, activity: f.querySelector('#lg-act').value, part: (f.querySelector('#lg-part') || {}).value || '', source: f.dataset.fromTimer ? 'timer' : 'manual', at: Date.now() };
    S.sessions.push(sess);
    if (itemId) {
      setStatus(itemId, f.querySelector('#lg-status').value);
      const txt = f.querySelector('#lg-note').value.trim();
      if (txt) { const s2 = st(itemId); s2.notes = s2.notes || []; s2.notes.push({ id: 'n' + Date.now(), type: 'Approach', body: txt, at: Date.now(), session: sess.id }); S.items[itemId] = s2; }
    }
    save();
    if (f.dataset.fromTimer) setT(null);
    document.getElementById('logdlg').close();
    tick(); refresh();
    const di = dayInfo(today());
    toast(di.status === 'ok' ? 'Logged. Today is complete.' : 'Logged ' + minutes + ' min.');
  }

  // ---------- global events ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.open) { e.preventDefault(); openItem(t.dataset.open); }
    else if (t.hasAttribute('data-close')) { t.closest('dialog').close(); }
    else if (t.dataset.start) { startTimer(t.dataset.start, t.dataset.item || null); }
    else if (t.dataset.startItem) { const it = byId[t.dataset.startItem]; document.getElementById('itemdlg').close(); startTimer(it.track, it.id); }
    else if (t.dataset.logItem) { const it = byId[t.dataset.logItem]; document.getElementById('itemdlg').close(); openLog({ track: it.track, itemId: it.id }); }
    else if (t.dataset.log) { openLog({ track: t.dataset.log }); }
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
    const t = getT();
    const running = t && t.track === track;
    const cls = done ? 's-ok' : running ? 's-run' : mins > 0 ? 's-part' : '';
    const label = done ? 'Done' : running ? 'Running' : mins > 0 ? 'Under the minimum' : 'Not started';
    const sug = suggest(track);
    const pct = Math.min(100, Math.round((mins / tgt) * 100));
    const name = track === 'dsa' ? 'DSA' : 'System design';
    return '<article class="task ' + cls + '"><header><h2>' + name + '</h2><span class="state">' + label + '</span></header>' +
      '<p class="mins">' + mins + ' <span>of ' + tgt + ' min</span></p><div class="bar" role="img" aria-label="' + pct + ' percent of target"><i style="width:' + pct + '%"></i></div>' +
      (sug ? '<p class="next">' + sug.why + ': <button class="linkish" data-open="' + sug.item.id + '">' + esc(sug.item.title) + '</button> <span class="muted small">' + esc(topicBy[sug.item.topic].name) + (sug.item.diff ? ', ' + sug.item.diff : '') + '</span></p>' : '<p class="next muted">Every item started. Pick one to revise.</p>') +
      '<div class="actions"><button class="btn primary" data-start="' + track + '"' + (sug ? ' data-item="' + sug.item.id + '"' : '') + (t ? ' disabled' : '') + '>Start timer</button><button class="btn" data-log="' + track + '">Log time</button></div></article>';
  }

  function runGrid(weeks) {
    const t = today();
    const end = addDays(t, 6 - ((dow(t) + 6) % 7)); // end on Sunday of this week
    const days = weeks * 7;
    let html = '<div class="rungrid" role="img" aria-label="Daily history for the last ' + weeks + ' weeks"><span></span><span class="rl">DSA</span><span class="rl">System design</span><span class="rl">Day</span>';
    let lastMonth = '';
    const first = S.sessions.reduce((m, x) => (x.date < m ? x.date : m), t);
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(end, -i);
      const fut = d > t;
      const info = fut ? null : dayInfo(d);
      if (info && d < first && info.status === 'miss') info.status = '';
      const [y, m] = d.split('-');
      const mo = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
      const showMo = mo !== lastMonth && Number(d.slice(8)) <= 7 && dow(d) === 1;
      if (showMo) lastMonth = mo;
      const c = (k) => fut ? 'future' : k;
      const trackCls = (done, min) => c(done ? 'ok' : min > 0 ? 'part' : (info && info.status === 'rest' ? 'rest' : ''));
      const title = fut ? d : d + ': DSA ' + info.dsa + ' min, system design ' + info.sd + ' min';
      html += '<span class="mo">' + (showMo ? mo : '') + '</span>' +
        '<span class="cell ' + (fut ? 'future' : trackCls(info.dsaDone, info.dsa)) + '" title="' + title + '"></span>' +
        '<span class="cell ' + (fut ? 'future' : trackCls(info.sdDone, info.sd)) + '" title="' + title + '"></span>' +
        '<span class="cell ' + (fut ? 'future' : info.status) + (d === t ? ' today' : '') + '" title="' + title + '"></span>';
    }
    return html + '</div>';
  }
  const legend = '<div class="legend"><span><i class="cell ok"></i>Done</span><span><i class="cell part"></i>Some time, under minimum</span><span><i class="cell rest"></i>Rest day</span><span><i class="cell miss"></i>Missed day</span><span><i class="cell"></i>Nothing logged</span></div>';

  function renderHome() {
    const t = today(); const info = dayInfo(t); const tg = targets(t);
    document.getElementById('today-date').textContent = niceDate(t);
    const s = streak();
    document.getElementById('streak').textContent = s ? s + '-day streak' : 'No streak yet. Complete today to start one.';
    const endTxt = { ok: ['Complete', 'Both tasks done. The streak grows tonight.'], part: ['Partial', 'One task left. Even 20 minutes counts.'], miss: ['Not started', 'Two tasks to go today.'], rest: ['Rest day', 'Streak kept. Back tomorrow.'] }[info.status];
    document.getElementById('run').innerHTML = taskNode('dsa', info, tg.dsa) + '<div class="edge" aria-hidden="true"></div>' + taskNode('sd', info, tg.sd) + '<div class="edge" aria-hidden="true"></div>' +
      '<div class="dayend' + (info.status === 'ok' ? ' done' : '') + '"><span class="muted small">Day result</span><strong>' + endTxt[0] + '</strong><span class="small muted">' + endTxt[1] + '</span>' +
      (info.status !== 'ok' && !S.rest.includes(t) && restUsedThisWeek() < S.settings.restPerWeek ? '<button class="btn quiet small" id="userest" style="align-self:start">Use rest day</button>' : '') + '</div>';
    const ur = document.getElementById('userest'); if (ur) ur.onclick = () => { S.rest.push(t); save(); renderHome(); toast('Rest day used'); };
    document.getElementById('grid').innerHTML = '<div class="gridscroll">' + runGrid(12) + '</div>' + legend;
    const gw = document.querySelector('#grid .gridscroll'); gw.scrollLeft = gw.scrollWidth;
    const due = dueItems();
    document.getElementById('due').innerHTML = due.length ? due.slice(0, 8).map((i) => { const s2 = st(i.id); const key = (s2.notes || []).find((n) => n.id === s2.pinned); return '<li><span><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (key ? '<span class="muted small" style="display:block">' + esc(key.body.slice(0, 110)) + '</span>' : '') + '</span><span class="chip st-' + s2.status + '">' + STATUS_LABEL[s2.status] + '</span></li>'; }).join('') : '<li class="muted">Nothing due. Items come back here 1 to 30 days after you set their status.</li>';
    tick();
  }

  function renderList(track) {
    const tps = (track === 'dsa' ? D.dsaTopics : D.sdTopics);
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
          const src = i.links.length ? i.links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.p) + '</a>').join(' ') + (i.premium ? ' <span class="muted">(premium)</span>' : '') : (i.track === 'sd' ? '<a href="https://www.youtube.com/results?search_query=' + encodeURIComponent(i.title + ' data engineering system design') + '" target="_blank" rel="noopener">Find a video</a>' : '<span class="muted">Question only</span>');
          return '<tr><td class="t"><button class="linkish" data-open="' + i.id + '">' + esc(i.title) + '</button>' + (i.angle ? '<span class="angle">' + esc(i.angle) + '</span>' : '') + (i.fits && i.fits.length ? '<span class="angle fits">Fits: ' + i.fits.join(', ') + '</span>' : '') + '</td>' +
            '<td class="hide-sm">' + (i.diff ? '<span class="diff ' + i.diff + '">' + i.diff + '</span>' : '<span class="muted small">' + (i.type === 'case' ? 'Design case' : 'Concept') + '</span>') + '</td>' +
            '<td class="src hide-sm">' + src + '</td><td><span class="chip st-' + s.status + '">' + STATUS_LABEL[s.status] + '</span>' + (isDue(i.id) ? ' <span class="chip due">Due</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    });
    document.getElementById('list').innerHTML = out || '<p class="muted">No items match these filters. Clear the search or pick another status.</p>';
  }
  function initList(track) {
    const tps = (track === 'dsa' ? D.dsaTopics : D.sdTopics);
    document.getElementById('f-topic').innerHTML = '<option value="">All topics</option>' + tps.map((t) => '<option value="' + t.code + '">' + t.code + ' ' + esc(t.name) + '</option>').join('');
    document.getElementById('f-status').innerHTML = '<option value="">Any status</option><option value="due">Due for revision</option>' + STATUS[track].map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
    const total = D.items.filter((i) => i.track === track).length;
    const cnt = document.getElementById('count'); if (cnt) cnt.textContent = total;
    ['f-q', 'f-topic', 'f-status', 'f-diff'].forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => renderList(track)); });
    refresh = () => renderList(track);
    renderList(track);
  }

  function renderProgress() {
    const t = today();
    const range = (from) => S.sessions.filter((s) => s.date >= from && s.date <= t);
    const sum = (arr, tr) => arr.filter((s) => !tr || s.track === tr).reduce((a, s) => a + s.minutes, 0);
    const wk = range(addDays(t, -((dow(t) + 6) % 7)));
    const mo = range(t.slice(0, 8) + '01');
    let complete = 0; for (let i = 0; i < 28; i++) if (dayInfo(addDays(t, -i)).status === 'ok') complete++;
    const wd = sum(wk, 'dsa'), ws = sum(wk, 'sd');
    document.getElementById('kpis').innerHTML =
      '<div class="kpi"><div class="v">' + fmtH(wd + ws) + '</div><div class="l">This week</div></div>' +
      '<div class="kpi"><div class="v">' + fmtH(sum(mo)) + '</div><div class="l">This month</div></div>' +
      '<div class="kpi"><div class="v">' + complete + ' / 28</div><div class="l">Complete days, last 4 weeks</div></div>' +
      '<div class="kpi"><div class="v">' + streak() + '</div><div class="l">Current streak</div></div>';
    const tot = wd + ws || 1;
    document.getElementById('split').innerHTML = '<p class="small muted">This week: DSA ' + fmtH(wd) + ', system design ' + fmtH(ws) + '</p><div class="splitbar" role="img" aria-label="DSA ' + Math.round(wd / tot * 100) + ' percent"><span class="a" style="width:' + (wd / tot * 100) + '%"></span><span class="b" style="width:' + (ws / tot * 100) + '%"></span></div>';
    document.getElementById('grid').innerHTML = '<div class="gridscroll">' + runGrid(16) + '</div>' + legend;
    const gw = document.querySelector('#grid .gridscroll'); gw.scrollLeft = gw.scrollWidth;
    document.getElementById('topics').innerHTML = '<table class="dtable"><thead><tr><th>Topic</th><th class="num">Items</th><th class="num">Done</th><th class="num">Due</th><th class="num">Time</th></tr></thead><tbody>' +
      topics.map((tp) => { const its = D.items.filter((i) => i.topic === tp.code); const mins = its.reduce((a, i) => a + minutesFor(i.id), 0); return '<tr><td>' + tp.code + ' ' + esc(tp.name) + ' <span class="muted small">P' + tp.priority + '</span></td><td class="num">' + its.length + '</td><td class="num">' + its.filter((i) => ['solved', 'done', 'mastered'].includes(st(i.id).status)).length + '</td><td class="num">' + its.filter((i) => isDue(i.id)).length + '</td><td class="num">' + (mins ? fmtH(mins) : '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    const recent = S.sessions.slice().sort((a, b) => b.at - a.at).slice(0, 40);
    document.getElementById('sessions').innerHTML = recent.length ? '<table class="dtable"><thead><tr><th>Day</th><th>Track</th><th>Item</th><th>Activity</th><th class="num">Minutes</th><th></th></tr></thead><tbody>' +
      recent.map((s) => '<tr><td>' + s.date + '</td><td>' + (s.track === 'dsa' ? 'DSA' : 'System design') + '</td><td>' + (byId[s.itemId] ? '<button class="linkish" data-open="' + s.itemId + '">' + esc(byId[s.itemId].title) + '</button>' : '<span class="muted">—</span>') + (s.part ? ' <span class="muted small">(' + esc(s.part) + ')</span>' : '') + '</td><td>' + esc((ACTIVITY[s.track].find((a) => a[0] === s.activity) || ['', s.activity])[1]) + '</td><td class="num">' + s.minutes + '</td><td><button class="linkish small" data-delsess="' + s.id + '">Delete</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted">No sessions yet. Start a timer on <a href="index.html">Today</a> or log time manually.</p>';
  }
  function initProgress() {
    refresh = renderProgress; renderProgress();
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-delsess]'); if (b && confirm('Delete this session?')) { S.sessions = S.sessions.filter((s) => s.id !== b.dataset.delsess); save(); renderProgress(); } });
    document.getElementById('export').onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dataleap-backup-' + today() + '.json'; a.click();
    };
    document.getElementById('import').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader();
      r.onload = () => { try { const d = JSON.parse(r.result); if (!d.sessions || !d.items) throw 0; S = Object.assign(defaults(), d); save(); renderProgress(); toast('Backup restored'); } catch (err) { toast('That file is not a DataLeap backup.'); } };
      r.readAsText(file);
    };
  }

  function initSettings() {
    const f = document.getElementById('goalform');
    const fields = ['dsaWeekday', 'sdWeekday', 'dsaWeekend', 'sdWeekend', 'minSession', 'dayStart', 'restPerWeek'];
    fields.forEach((k) => { f.elements[k].value = S.settings[k]; });
    f.onsubmit = (e) => { e.preventDefault(); fields.forEach((k) => { S.settings[k] = Math.max(0, parseInt(f.elements[k].value, 10) || 0); }); save(); toast('Goal saved'); };
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const FOCUS = { either: 'Either', dsa: 'DSA', sd: 'System design' };
    function renderRem() {
      document.getElementById('remlist').innerHTML = S.reminders.length ? '<table class="dtable"><thead><tr><th>Time</th><th>Days</th><th>Focus</th><th>Message</th><th>Rules</th><th></th></tr></thead><tbody>' +
        S.reminders.slice().sort((a, b) => a.time.localeCompare(b.time)).map((r) => '<tr><td><b>' + r.time + '</b></td><td>' + (r.days.length === 7 ? 'Every day' : r.days.length === 5 && !r.days.includes(0) && !r.days.includes(6) ? 'Weekdays' : r.days.map((d) => DAYS[d]).join(' ')) + '</td><td>' + FOCUS[r.focus] + '</td><td>' + esc(r.msg) + '</td><td class="small muted">' + [r.skip ? 'Skips when done' : '', r.last ? 'Last call' : ''].filter(Boolean).join(', ') + '</td><td style="white-space:nowrap"><label class="small" style="display:inline-flex;gap:.3rem;align-items:center;font-weight:400"><input type="checkbox" data-remon="' + r.id + '"' + (r.on ? ' checked' : '') + ' style="width:auto"> On</label> <button class="linkish small" data-remdel="' + r.id + '">Delete</button></td></tr>').join('') + '</tbody></table>'
        : '<p class="muted">No reminders. Add one below; most people use three: morning, lunch and night.</p>';
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
    const pb = document.getElementById('perm');
    const ps = document.getElementById('permstate');
    const showPerm = () => { ps.textContent = !('Notification' in window) ? 'This browser does not support notifications.' : Notification.permission === 'granted' ? 'Browser notifications are on.' : Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in the browser\'s site settings.' : 'Browser notifications are off.'; pb.hidden = !('Notification' in window) || Notification.permission !== 'default'; };
    pb.onclick = () => Notification.requestPermission().then(showPerm);
    showPerm();
    document.getElementById('reset').onclick = () => { if (confirm('Delete all progress, notes and settings in this browser? Export a backup first if you need it.')) { localStorage.removeItem(KEY); localStorage.removeItem(TKEY); location.reload(); } };
  }

  // ---------- reminders (only while a DataLeap tab is open) ----------
  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(); const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const t = today(); const info = dayInfo(t);
    S.reminders.forEach((r) => {
      if (!r.on || r.time !== hm || !r.days.includes(now.getDay())) return;
      const k = t + r.id; if (S.fired[k]) return;
      if (S.rest.includes(t)) return;
      if (r.last && info.status === 'ok') return;
      if (r.skip && ((r.focus === 'dsa' && info.dsaDone) || (r.focus === 'sd' && info.sdDone) || (r.focus === 'either' && info.status === 'ok'))) return;
      S.fired[k] = 1; save();
      const n = new Notification('DataLeap', { body: r.msg + (info.status === 'part' ? ' (one task left today)' : '') });
      n.onclick = () => { window.focus(); location.href = 'index.html'; };
    });
  }

  // ---------- boot ----------
  renderChrome();
  const page = document.body.dataset.page;
  if (page === 'home') { refresh = renderHome; renderHome(); }
  else if (page === 'dsa') initList('dsa');
  else if (page === 'sd') initList('sd');
  else if (page === 'progress') initProgress();
  else if (page === 'settings') initSettings();
  tick();
  setInterval(tick, 1000);
  setInterval(checkReminders, 20000);
  checkReminders();
  window.addEventListener('storage', () => { try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {} refresh(); tick(); });
})();
