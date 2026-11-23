/* DataLeap voice entry: a mic in every text box. Same flow as Kharcha Check:
   explain, then ask for the mic; if blocked, show exactly how to fix it; check that the phone's speech app works;
   on-device recognition first; clear help for every error; Google's voice screen as a last resort.
   In the Android app the native recogniser does the listening (window.AndroidBridge.voice*);
   in a browser it uses the Web Speech API where the browser has one (Chrome, Edge). */
(function () {
  const BR = window.AndroidBridge && window.AndroidBridge.voiceStart ? window.AndroidBridge : null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!BR && !SR) return; // no voice on this browser: no mic buttons

  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let target = null, screen = false, prompt = 'Speak now', phase = null, deniedOnce = false, partial = '', webRec = null, webFinal = '', problem = null;

  // ---------- mic buttons ----------
  const SEL = 'textarea, input[type="text"], input[type="search"], input:not([type])';
  function labelFor(el) {
    const l = el.id && document.querySelector('label[for="' + el.id + '"]');
    return (l && l.textContent.trim()) || el.getAttribute('aria-label') || el.placeholder || 'Speak now';
  }
  function attach(el) {
    if (el.dataset.mic || el.closest('.micwrap') || el.type === 'hidden' || el.readOnly) return;
    el.dataset.mic = '1';
    const w = document.createElement('span');
    w.className = 'micwrap' + (el.tagName === 'TEXTAREA' ? ' ta' : '');
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mic'; b.innerHTML = MIC; b.setAttribute('aria-label', 'Speak into: ' + labelFor(el));
    b.addEventListener('click', (e) => { e.preventDefault(); open(el); });
    w.appendChild(b);
  }
  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach(attach); }
  let scanQueued = false;
  new MutationObserver(() => { if (scanQueued) return; scanQueued = true; requestAnimationFrame(() => { scanQueued = false; scan(document); }); })
    .observe(document.body, { childList: true, subtree: true });
  scan(document);

  // ---------- sheet ----------
  const dlg = document.createElement('dialog');
  dlg.id = 'voicedlg'; dlg.className = 'vdlg'; dlg.setAttribute('aria-live', 'polite');
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => { if (phase === 'listening') cancelListening(); phase = null; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function show(html) { dlg.innerHTML = '<div class="vsheet">' + html + '</div>'; if (!dlg.open) dlg.showModal(); wire(); }
  function guide(icon, title, body, steps, primary, secondary) {
    show('<div class="vicon" aria-hidden="true">' + icon + '</div><h2>' + esc(title) + '</h2><p class="vbody">' + esc(body) + '</p>' +
      (steps && steps.length ? '<ol class="vsteps">' + steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '') +
      '<div class="vactions"><button class="btn quiet" data-v="close" type="button">Not now</button>' +
      (secondary ? '<button class="btn" data-v="' + secondary[1] + '" type="button">' + esc(secondary[0]) + '</button>' : '') +
      '<button class="btn primary" data-v="' + primary[1] + '" type="button">' + esc(primary[0]) + '</button></div>');
  }
  function wire() { dlg.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => act(b.dataset.v); }); }

  function act(v) {
    const st = BR ? status() : null;
    if (v === 'close') dlg.close();
    else if (v === 'ask') BR.voiceRequestMic();
    else if (v === 'settings') BR.openAppSettings('');
    else if (v === 'svc') BR.openAppSettings(st && st.service ? st.service.pkg : 'com.google.android.googlequicksearchbox');
    else if (v === 'store') BR.openSpeechStore();
    else if (v === 'voiceset') BR.openVoiceSettings();
    else if (v === 'retry') listenOrSetup();
    else if (v === 'anyway') listen();
    else if (v === 'google') { screen = true; dlg.close(); BR.voiceGoogleScreen(prompt); }
    else if (v === 'done') { if (BR) BR.voiceStop(); else if (webRec) webRec.stop(); }
    else if (v === 'reload') location.reload();
  }

  function status() { try { return JSON.parse(BR.voiceStatus()); } catch (e) { return { hasMic: false, available: false, onDevice: false, service: null }; } }

  function open(el) { target = el; prompt = labelFor(el); deniedOnce = false; listenOrSetup(); }

  function listenOrSetup() {
    if (!BR) { listen(); return; }
    const st = status(); const svc = st.service;
    if (!st.hasMic) explain();
    else if (!st.available && !st.onDevice) noService();
    else if (svc && (!svc.enabled || !svc.hasMic) && !st.onDevice) serviceMic(svc);
    else listen();
  }

  function explain() {
    phase = 'explain';
    guide('🎤', 'Speak instead of typing',
      deniedOnce ? 'Voice entry needs the microphone. You tapped “Don’t allow”, so nothing was turned on.'
        : 'To hear you, DataLeap needs the microphone. It listens only while this sheet is open and never saves or uploads recordings. Only the words reach the app.',
      ['Tap “Allow microphone” below', 'Choose “While using the app”', 'Say your note, e.g. “Partitioned by event date, missed the late data case”'],
      ['Allow microphone', 'ask']);
  }
  function blocked() {
    phase = 'blocked';
    guide('🔇', 'Microphone is off for DataLeap', 'Android won’t ask again, so turn it on in Settings. It takes four taps:',
      ['Tap “Open settings” below', 'Tap Permissions', 'Tap Microphone', 'Choose “Allow only while using the app”, then come back'],
      ['Open settings', 'settings']);
  }
  function noService() {
    phase = 'noservice';
    guide('🗣️', 'Voice typing isn’t set up on this phone', 'Android needs a speech service to turn your voice into text. Most phones use Google’s free one.',
      ['Install or update “Speech Recognition & Synthesis from Google” (button below)', 'Make sure the Google app isn’t disabled: Settings → Apps → Google → Enable',
        'Settings → System → Languages & input → Voice input → choose Google', 'Come back and tap the mic again'],
      ['Open Play Store', 'store'], ['Try again', 'retry']);
  }
  function serviceMic(svc) {
    phase = 'servicemic';
    const name = (svc && svc.label) || 'Google';
    const off = svc && svc.enabled === false;
    guide('🎙️', off ? 'The “' + name + '” app is turned off' : 'Allow the microphone for “' + name + '”',
      'DataLeap already has the microphone. Android’s voice typing is done by the “' + name + '” app, and it also needs the microphone. That’s why voice typing isn’t working.',
      off ? ['Tap “Open ' + name + ' settings” below', 'Tap Enable (or Turn on)', 'Then: Permissions → Microphone → Allow', 'Come back and tap the mic']
        : ['Tap “Open ' + name + ' settings” below', 'Tap Permissions', 'Tap Microphone', 'Choose “Allow only while using the app”, then come back'],
      ['Open ' + name + ' settings', 'svc'], ['Try anyway', 'anyway']);
  }
  function errorSheet(p) {
    phase = 'error';
    guide('🎤', p.title, p.body, p.steps || [], ['Try again', 'retry'], p.fix ? p.fix : (BR ? ['Use Google’s voice screen', 'google'] : null));
  }

  function listening(text, ready) {
    const lv = dlg.querySelector('.vring');
    const live = dlg.querySelector('.vlive');
    if (phase === 'listening' && live) {
      live.textContent = text ? '“' + text + '”' : ready ? 'Listening… speak now' : 'Starting the mic…';
      live.classList.toggle('has', !!text);
      return lv;
    }
    phase = 'listening';
    show('<p class="vprompt">' + esc(prompt) + '</p><div class="vmicwrap"><span class="vring"></span><span class="vmic">' + MIC + '</span></div>' +
      '<p class="vlive">Starting the mic…</p><p class="vhint">Speak naturally. Your words are added to the box.</p>' +
      '<div class="vactions center"><button class="btn quiet" data-v="close" type="button">Cancel</button><button class="btn primary" data-v="done" type="button">Done</button></div>' +
      '<p class="vprivacy">Recordings are never saved. Only the words reach DataLeap.</p>');
    return null;
  }

  function listen() {
    partial = ''; listening('', false);
    if (BR) { BR.voiceStart(prompt); return; }
    try {
      webRec = new SR(); webFinal = '';
      webRec.lang = 'en-IN'; webRec.interimResults = true; webRec.continuous = false; webRec.maxAlternatives = 1;
      webRec.onstart = () => listening('', true);
      webRec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) webFinal += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
        }
        partial = (webFinal + ' ' + interim).trim(); listening(partial, true);
      };
      webRec.onerror = (e) => { webRec._err = e.error; };
      webRec.onend = () => {
        const err = webRec && webRec._err; const text = (webFinal || partial).trim(); webRec = null;
        if (phase !== 'listening') return;
        if (text) { insert(text); dlg.close(); return; }
        if (err === 'not-allowed' || err === 'service-not-allowed') webBlocked();
        else if (err === 'network') errorSheet({ title: 'Voice typing needs internet here', body: 'This browser sends speech to its speech service to turn it into text. Connect to the internet and try again, or use the DataLeap app.' });
        else if (err === 'audio-capture') errorSheet({ title: 'No microphone found', body: 'This device has no working microphone, or another app is using it.' });
        else if (err === 'aborted') dlg.close();
        else errorSheet({ title: 'Didn’t catch that', body: 'Tap Try again and speak right after the sheet says “Listening”, a little closer to the microphone.' });
      };
      webRec.start();
    } catch (e) { errorSheet({ title: 'Voice typing isn’t available', body: 'This browser could not start the microphone. Try Chrome, or the DataLeap app.' }); }
  }
  function webBlocked() {
    phase = 'blocked';
    guide('🔇', 'The browser blocked the microphone', 'The site needs microphone permission once. To allow it:',
      ['Tap the lock or settings icon left of the address', 'Tap Permissions (or Site settings)', 'Set Microphone to Allow', 'Reload the page and tap the mic again'],
      ['Reload page', 'reload']);
  }
  function cancelListening() { if (BR) BR.voiceCancel(); else if (webRec) { try { webRec.abort(); } catch (e) {} } }

  function insert(text) {
    if (!target) return;
    text = text.trim(); if (!text) return;
    const cur = target.value;
    const t = cur && !/\s$/.test(cur) ? ' ' + text : (cur ? text : text.charAt(0).toUpperCase() + text.slice(1));
    target.value = cur + t;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    try { target.focus(); target.setSelectionRange(target.value.length, target.value.length); } catch (e) {}
  }

  function problemFor(code, onDevice) {
    if (code === 7 || code === 6) return { title: 'Didn’t catch that', body: 'Tap Try again and speak right after the sheet says “Listening”, a little closer to the phone.' };
    if (code === 1 || code === 2 || code === 4 || code === 11) return { title: 'Voice typing needs internet on this phone', body: 'Your phone’s speech service couldn’t reach its server. Connect to the internet, or download English (India) to use voice typing offline:',
      steps: ['Tap “Open voice settings” below', 'Open Google voice typing (or Speech Recognition by Google)', 'Offline speech recognition → All → download English (India)'], fix: ['Open voice settings', 'voiceset'] };
    if (code === 12 || code === 13) return { title: 'English (India) isn’t ready for voice typing', body: 'Download the language once and voice typing also works offline:',
      steps: ['Tap “Open voice settings” below', 'Open Google voice typing', 'Languages → add English (India), then Offline speech recognition → download it'], fix: ['Open voice settings', 'voiceset'] };
    if (code === 8 || code === 10) return { title: 'Voice typing is busy', body: 'Another app is using voice typing. Wait a second and tap Try again.' };
    if (code === 3) return { title: 'Couldn’t use the microphone', body: 'Another app (a call, a recorder or a voice assistant) may be using it. Close that and tap Try again.' };
    return { title: 'Voice typing stopped', body: 'Your phone’s speech service didn’t respond (code ' + code + (onDevice ? ', on-device' : '') + '). Try again, or use Google’s voice screen instead.' };
  }

  // Events from the Android recogniser
  window.dlVoiceEvent = (e) => {
    if (!e) return;
    if (e.type === 'perm') {
      if (e.granted) listenOrSetup();
      else if (e.canAskAgain) { deniedOnce = true; explain(); }
      else blocked();
      return;
    }
    if (e.type === 'result') { if (phase === 'listening' || screen) { screen = false; insert(e.text); phase = null; if (dlg.open) dlg.close(); } return; }
    if (e.type === 'cancel') { screen = false; phase = null; return; }
    if (phase !== 'listening') return;
    if (e.type === 'ready') listening(partial, true);
    else if (e.type === 'partial') { partial = e.text; listening(partial, true); }
    else if (e.type === 'level') { const r = dlg.querySelector('.vring'); if (r) r.style.transform = 'scale(' + (1 + e.v * 0.45).toFixed(2) + ')'; }
    else if (e.type === 'error') {
      const st = status(); const svc = st.service;
      if (e.code === 9) { if (st.hasMic) serviceMic(svc); else explain(); }
      else if ((e.code === 3 || e.code === 5) && svc && (!svc.hasMic || !svc.enabled)) serviceMic(svc);
      else errorSheet(problemFor(e.code, e.onDevice));
    }
  };

  // Coming back from Settings with the problem fixed goes straight to listening.
  window.dlVoiceResume = () => {
    if (!BR || !dlg.open) return;
    const st = status(); const svc = st.service;
    if (phase === 'blocked' && st.hasMic) listenOrSetup();
    else if (phase === 'servicemic' && svc && svc.enabled && svc.hasMic) listenOrSetup();
    else if (phase === 'noservice' && (st.available || st.onDevice)) listenOrSetup();
  };
})();
