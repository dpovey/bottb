// Review controls: covers, facts, captions and confirmation for each reel, saved to reviews/<key> in the artifact db.
(function () {
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reels = $$('section.reel'), state = {}, timers = {}, writing = {}, waiting = {};
  let db = null, loaded = false;
  const banner = $('#save-state');
  const say = (t, bad) => { banner.textContent = t; banner.classList.toggle('bad', !!bad); };

  const text = (el) => el.value;
  const fields = (sec) => $$('[data-field]', sec);
  const blank = () => ({ cover: null, copy: {}, facts: {}, confirmed: false });
  const lint = (key, v) => {
    const out = [];
    if (/@[\w.]+\.(\s|$)/.test(v)) out.push('Full stop straight after an @handle.');
    if (/[—–]/.test(v)) out.push('Has a long dash.');
    return out.join(' ');
  };
  function ready(sec, s) {
    const facts = $$('[data-fact]', sec);
    return s.cover !== null && facts.every((f) => s.facts[f.dataset.fact] && s.facts[f.dataset.fact].answer);
  }
  function paint(sec) {
    const key = sec.id, s = state[key];
    $$('[data-cover]', sec).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cover === s.cover)));
    $$('[data-fact]', sec).forEach((f) => {
      const a = s.facts[f.dataset.fact] || {};
      $$('[data-answer]', f).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.answer === a.answer)));
      const n = $('input', f);
      if (document.activeElement !== n) n.value = a.note || '';
    });
    fields(sec).forEach((el) => {
      const k = el.dataset.field, edited = Object.prototype.hasOwnProperty.call(s.copy, k);
      if (document.activeElement !== el) { el.value = edited ? s.copy[k] : el.defaultValue; size(el); }
      const box = el.closest('.cap');
      $('.count', box).textContent = text(el).length.toLocaleString() + ' characters';
      $('.reset', box).hidden = !edited;
      $('.edited', box).hidden = !edited;
      $('.lint', box).textContent = lint(k, text(el));
    });
    const btn = $('.confirm', sec), can = ready(sec, s);
    btn.disabled = !db || (!can && !s.confirmed);
    btn.textContent = s.confirmed ? 'Confirmed. Undo' : 'Confirm this reel';
    btn.classList.toggle('done', s.confirmed);
    const hint = $('.confirm-hint', sec);
    hint.textContent = s.confirmed ? 'I\'ll schedule this exactly as written. Any change here takes the confirmation off.'
      : can ? (s.was ? 'Changed since you confirmed, so it needs confirming again.' : 'Confirming is your go to schedule this exactly as written.')
        : 'Pick a cover and answer every fact first.';
    const nav = $(`[data-nav="${key}"] .st`);
    nav.textContent = s.confirmed ? 'Confirmed' : (s.cover !== null || Object.keys(s.copy).length || Object.keys(s.facts).length) ? 'In progress' : 'To review';
    nav.className = 'st' + (s.confirmed ? ' ok' : '');
    const done = reels.filter((r) => state[r.id].confirmed).length;
    $('#progress').textContent = `${done} of ${reels.length} confirmed`;
  }
  const size = (el) => { if (el.tagName === 'TEXTAREA') { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } };

  async function flush(key) {
    if (writing[key]) { waiting[key] = true; return; }
    writing[key] = true; say('Saving...');
    try {
      await db.doc('reviews/' + key).set(JSON.parse(JSON.stringify(payload(key))));
      say('Saved');
    } catch (e) {
      say(e && e.code === 'invalid_argument' ? 'You can only view this page, so changes aren\'t saved.' : 'Not saved. Check your connection and change something to try again.', true);
    }
    writing[key] = false;
    if (waiting[key]) { waiting[key] = false; flush(key); }
  }
  function payload(key) {
    const s = state[key], sec = document.getElementById(key), body = { cover: s.cover, copy: s.copy, facts: s.facts, confirmed: s.confirmed, was_confirmed: !!s.was };
    if (s.confirmed) {
      body.confirmed_at = s.confirmed_at;
      body.final = Object.fromEntries(fields(sec).map((el) => [el.dataset.field, text(el)]));
    }
    return body;
  }
  function changed(key, soon) {
    const s = state[key];
    paint(document.getElementById(key));
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { delete timers[key]; flush(key); }, soon ? 0 : 700);
    say('Saving...');
    return s;
  }
  function unconfirm(s) { if (s.confirmed) { s.confirmed = false; s.was = true; delete s.confirmed_at; } }

  reels.forEach((sec) => { state[sec.id] = blank(); });
  reels.forEach((sec) => {
    const key = sec.id;
    sec.addEventListener('click', (e) => {
      if (!db) return;
      const s = state[key], cover = e.target.closest('[data-cover]'), ans = e.target.closest('[data-answer]');
      if (cover) { s.cover = s.cover === cover.dataset.cover ? null : cover.dataset.cover; unconfirm(s); changed(key, true); }
      else if (ans) {
        const id = ans.closest('[data-fact]').dataset.fact, a = s.facts[id] || {};
        a.answer = a.answer === ans.dataset.answer ? null : ans.dataset.answer;
        s.facts[id] = a; unconfirm(s); changed(key, true);
      } else if (e.target.closest('.reset')) {
        const el = $('[data-field]', e.target.closest('.cap'));
        delete s.copy[el.dataset.field]; el.value = el.defaultValue; size(el); unconfirm(s); changed(key, true);
      } else if (e.target.closest('.confirm')) {
        if (s.confirmed) { s.confirmed = false; s.was = false; delete s.confirmed_at; }
        else if (ready(sec, s)) { s.confirmed = true; s.was = false; s.confirmed_at = new Date().toISOString(); }
        changed(key, true);
      }
    });
    sec.addEventListener('input', (e) => {
      if (!db) return;
      const s = state[key], el = e.target;
      if (el.dataset.field) {
        if (el.value === el.defaultValue) delete s.copy[el.dataset.field]; else s.copy[el.dataset.field] = el.value;
        size(el); unconfirm(s); changed(key);
      } else if (el.closest('[data-fact]')) {
        const id = el.closest('[data-fact]').dataset.fact, a = s.facts[id] || {};
        a.note = el.value; s.facts[id] = a; unconfirm(s); changed(key);
      }
    });
  });
  reels.forEach(paint);
  $$('textarea').forEach(size);
  window.addEventListener('resize', () => $$('textarea').forEach(size));
  // Keep typed text if the tab is closed during the save pause.
  window.addEventListener('pagehide', () => Object.keys(timers).forEach((k) => { clearTimeout(timers[k]); flush(k); }));

  function readOnly(msg) {
    say(msg, true);
    $$('textarea,input,.confirm,[data-cover],[data-answer]').forEach((c) => { c.disabled = true; });
  }
  (async () => {
    db = await claude.use('db');
    if (!db) return readOnly('Editing is off in this view, so nothing here can be saved. Open the page on claude.ai, signed in.');
    say('Loading your choices...');
    const slow = setTimeout(() => { if (!loaded) say('Can\'t reach saved choices yet. Don\'t edit until this clears.', true); }, 10000);
    db.collection('reviews').onSnapshot((snap) => {
      snap.docs.forEach((d) => {
        const sec = document.getElementById(d.id);
        if (!sec || timers[d.id] || writing[d.id] || d.metadata.hasPendingWrites) return;
        const b = d.data();
        state[d.id] = { cover: b.cover ?? null, copy: { ...(b.copy || {}) }, facts: JSON.parse(JSON.stringify(b.facts || {})), confirmed: !!b.confirmed, was: !!b.was_confirmed, confirmed_at: b.confirmed_at };
        paint(sec);
      });
      if (!snap.metadata.fromCache) { clearTimeout(slow); if (!loaded) say('Everything you change saves as you go'); loaded = true; }
    }, (e) => { clearTimeout(slow); readOnly('Saved choices stopped loading, so editing is off. Reload the page to try again.'); });
  })();
})();
