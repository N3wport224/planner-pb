// HABIT GAME website – reads and writes the HABIT GAME Google Sheet through WebApi.gs.
// No build step: plain ES2019, works on phones, tablets and desktops.
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const VIEWS = ['today', 'week', 'month', 'year', 'hero', 'settings'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const REFRESH_MS = 60000;

  // ---------------------------------------------------------------- storage (per-device conveniences)
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  const S = {
    config: store.get('hg.config', null),      // {url, key} or {demo: true}
    state: store.get('hg.state', null),        // last state for the current month
    monthView: null,                           // month shown on the Month screen (may differ)
    view: (location.hash || '#today').slice(1),
    weekDay: null,
    pending: 0,
    error: null,
  };
  if (VIEWS.indexOf(S.view) < 0) S.view = 'today';

  // ---------------------------------------------------------------- API
  function request(req) {
    const cfg = S.config;
    if (!cfg) return Promise.reject(new Error('Not connected'));
    if (cfg.demo) return window.HabitGameDemo.request(req);
    const body = Object.assign({key: cfg.key}, req);
    let p;
    if (!req.action) {
      const q = new URLSearchParams({key: cfg.key});
      if (req.month !== undefined && req.month !== null) q.set('month', req.month);
      p = fetch(cfg.url + '?' + q.toString(), {redirect: 'follow'});
    } else {   // text/plain keeps it a "simple" CORS request (no preflight) for Apps Script
      p = fetch(cfg.url, {method: 'POST', redirect: 'follow', body: JSON.stringify(body),
                          headers: {'Content-Type': 'text/plain;charset=utf-8'}});
    }
    return p.then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  let chain = Promise.resolve();
  /** Sends a change; UI was already updated optimistically. Server state wins once the queue drains. */
  function send(req) {
    S.pending++;
    setSync('busy');
    chain = chain.then(() => request(req)).then(res => {
      S.pending--;
      if (!res.ok) throw new Error(res.error || 'Request failed');
      if (S.pending === 0) receive(res.state);
      setSync('ok');
    }).catch(err => {
      S.pending = Math.max(0, S.pending - 1);
      setSync('error');
      toast('⚠️ ' + err.message + ' – reloading');
      refresh();
    });
    return chain;
  }

  function refresh(month) {
    if (!S.config) return Promise.resolve();
    setSync('busy');
    return request({month: month === undefined ? null : month}).then(res => {
      if (!res.ok) throw new Error(res.error === 'unauthorized' ? 'Wrong website key' : res.error);
      if (S.pending === 0) receive(res.state);
      S.error = null;
      setSync('ok');
    }).catch(err => {
      S.error = err.message;
      setSync(navigator.onLine === false ? 'offline' : 'error');
      if (!S.state) render();
    });
  }

  /** Merges a server state into the app, celebrating level-ups and new badges. */
  function receive(st) {
    const prev = S.state && S.state.character;
    const cur = currentMonthIdx(st);
    if (st.month.idx === cur) {
      S.state = st;
      store.set('hg.state', st);
    } else if (S.state) {
      S.state = Object.assign({}, S.state, {character: st.character, dashboard: st.dashboard, week: st.week, oura: st.oura});
    } else {
      S.state = st;
    }
    if (S.monthView && S.monthView.idx === st.month.idx) S.monthView = st.month;
    if (!S.monthView) S.monthView = st.month;
    if (prev) {
      const ch = S.state.character;
      if (ch.level > prev.level) toast(`⬆️ LEVEL UP!  Level ${ch.level}  ${ch.avatar} ${ch.title}`, 'levelup', 3200);
      else {
        const was = new Set(prev.badges.filter(b => b.unlocked).map(b => b.name));
        const fresh = ch.badges.find(b => b.unlocked && !was.has(b.name));
        if (fresh) toast(`🏅 Badge unlocked: ${fresh.icon} ${fresh.name}`, 'levelup', 3000);
      }
    }
    render();
  }

  // ---------------------------------------------------------------- helpers
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  const fmt = v => num(v).toLocaleString();
  const pct = v => Math.round(num(v) * 100) + '%';
  const parseIso = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => parseIso(S.state.today);
  function currentMonthIdx(st) {
    const t = parseIso(st.today);
    return t.getFullYear() === st.year ? t.getMonth() : st.month.idx;
  }
  function weekIdxOf(date) {
    const start = parseIso(S.state.week.start);
    const i = Math.round((date - start) / 864e5);
    return i >= 0 && i < 7 ? i : null;
  }
  const checkSvg = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
  function ring(p, size, label) {
    const r = 15.5, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, num(p)));
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--tick-off)" stroke-width="4.5"/>
      <circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--lime)" stroke-width="4.5" stroke-linecap="round"
        stroke-dasharray="${c * v} ${c}"/></svg><div class="lbl" style="font-size:${size / 5}px">${label || pct(v)}</div></div>`;
  }
  /** Avatars are one or two emoji; two need a smaller size to fit their box. */
  function isDuo(text) {
    const s = String(text || '');
    if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter().segment(s)].length > 1;
    return s.replace(/\uFE0F/g, '').length > 2;
  }
  const hbar = p => `<div class="hbar"><span style="width:${Math.max(0, Math.min(100, num(p) * 100))}%"></span></div>`;

  function setSync(status) {
    const el = $('#sync');
    el.className = 'sync' + (status === 'ok' ? '' : ' ' + status);
    el.title = {ok: 'Synced', busy: 'Syncing…', error: 'Sync problem', offline: 'Offline'}[status] || '';
  }

  let toastTimer;
  function toast(text, cls, ms) {
    const el = $('#toast');
    el.textContent = text;
    el.className = 'toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, ms || 2200);
  }

  function floatXp(target, xp) {
    if (!xp) return;
    const r = target.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = (xp > 0 ? '+' : '') + xp + ' XP';
    el.style.left = (r.left + r.width / 2 - 24) + 'px';
    el.style.top = (r.top - 8) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  /** Local, approximate XP change so the bar moves instantly; the sheet's numbers replace it. */
  function bumpXp(delta) {
    const ch = S.state.character;
    ch.xp = num(ch.xp) + delta;
    const span = num(ch.nextLevelXp) - num(ch.levelStartXp);
    if (span > 0) ch.pct = Math.max(0, Math.min(1, (ch.xp - ch.levelStartXp) / span));
  }

  // ---------------------------------------------------------------- render
  function render() {
    document.querySelectorAll('.tabbar button').forEach(b => {
      if (b.dataset.nav === S.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const view = $('#view');
    if (!S.config || S.view === 'settings') { view.innerHTML = settingsView(); return; }
    if (!S.state) {
      view.innerHTML = S.error
        ? `<div class="card banner"><b>Couldn't load your sheet.</b><p class="small">${esc(S.error)}</p>
           <button class="btn small" data-act="retry">Try again</button> <button class="btn small ghost" data-nav="settings">Settings</button></div>`
        : '<div class="empty">Loading your quest log…</div>';
      return;
    }
    const ch = S.state.character;
    $('#top-avatar').textContent = ch.avatar || '🎮';
    $('#top-avatar').classList.toggle('duo', isDuo(ch.avatar));
    $('#top-level').textContent = 'Lv ' + ch.level;
    $('#top-title').textContent = (ch.title || '') + ' · ' + fmt(ch.xp) + ' XP';
    $('#top-xp').style.width = (num(ch.pct) * 100) + '%';
    view.innerHTML = ({today: todayView, week: weekView, month: monthView, year: yearView, hero: heroView})[S.view]();
    if (S.view === 'month') {
      const wrap = view.querySelector('.grid-wrap'), td = view.querySelector('th.today');
      if (wrap && td) wrap.scrollLeft = Math.max(0, td.offsetLeft - wrap.clientWidth / 2);
    }
  }

  // ---------------------------------------------------------------- Today
  function todayView() {
    const st = S.state, ch = st.character, t = today();
    const m = st.month, day = t.getDate();
    const inYear = t.getFullYear() === st.year && m.idx === t.getMonth();
    const wi = weekIdxOf(t);
    let html = `<div class="date-h">${t.toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}
      <small>${ch.streak > 0 ? '🔥 ' + ch.streak + '-day streak' : 'Start a streak today'}</small></div>`;
    html += heroCard(ch, false);

    if (!inYear) {
      html += `<div class="card banner small">Your sheet is set to <b>${st.year}</b>. Change the year on the Dashboard tab
        to track ${t.getFullYear()}.</div>`;
    } else {
      const done = m.habits.filter(h => h.ticks[day - 1]).length;
      html += `<section class="card"><div class="card-h"><h2>Today's habits</h2>
        <span class="pill ${done === m.habits.length && done ? 'lime' : ''}">${done}/${m.habits.length}</span></div>`;
      html += m.habits.length ? '<ul class="checklist">' + m.habits.map(h => {
        const on = h.ticks[day - 1];
        return `<li class="${on ? 'done' : ''}"><button class="check ${on ? 'on' : ''}" data-act="habit"
          data-month="${m.idx}" data-h="${h.idx}" data-day="${day}" aria-pressed="${on}" aria-label="${esc(h.name)}">${checkSvg}</button>
          <span class="item-text">${esc(h.name)}</span></li>`;
      }).join('') + '</ul>' : '<div class="empty">Add your habits on the Dashboard tab of your sheet.</div>';
      html += '</section>';
    }

    html += '<section class="card"><div class="card-h"><h2>Today\'s tasks</h2>';
    if (wi === null) {
      html += `</div><p class="small muted">The planner holds the week of ${parseIso(st.week.start).toLocaleDateString()}.</p>
        <button class="btn small" data-act="newweek">Start a new week</button>`;
    } else {
      const d = st.week.days[wi];
      html += `<span class="pill">${d.done}/${d.done + d.left}</span></div>` + taskList(wi) ;
    }
    html += '</section>';

    if (inYear) html += wellnessCard(m, day);
    if (st.hasOura && st.month.oura && inYear) html += ouraCard(st, day);
    return html;
  }

  function heroCard(ch, big) {
    return `<section class="card hero-card"><div class="row">
      <div class="avatar-xl ${isDuo(ch.avatar) ? 'duo' : ''}">${esc(ch.avatar)}</div>
      <div class="grow"><div class="small muted">${esc(ch.name || 'Player')} · ${esc(ch.cls)}</div>
        <div style="font-size:20px;font-weight:800">${esc(ch.title)}</div>
        <div class="row small"><b>Level ${ch.level}</b><span class="grow"></span><span class="muted">${fmt(ch.xp)} XP</span></div>
        <div class="xpbar"><span style="width:${num(ch.pct) * 100}%"></span></div>
        <div class="small muted" style="margin-top:4px">${ch.level >= ch.maxLevel ? 'MAX LEVEL – Legend!'
          : fmt(ch.xp - ch.levelStartXp) + ' / ' + fmt(ch.nextLevelXp - ch.levelStartXp) + ' XP to Level ' + (ch.level + 1)}</div>
      </div></div>
      ${big ? '' : `<div class="stat-trio"><div><b>🔥 ${num(ch.streak)}</b><span class="small muted">streak</span></div>
        <div><b>🏆 ${num(ch.bestStreak)}</b><span class="small muted">best</span></div>
        <div><b>🏅 ${ch.badges.filter(b => b.unlocked).length}</b><span class="small muted">badges</span></div></div>`}
    </section>`;
  }

  function taskList(wi) {
    const tasks = S.state.week.days[wi].tasks;
    const firstEmpty = tasks.findIndex(t => !t.text);
    let html = '<ul class="checklist">' + tasks.map((t, row) => t.text ? `<li class="${t.done ? 'done' : ''}">
        <button class="check ${t.done ? 'on' : ''}" data-act="task" data-d="${wi}" data-r="${row}" aria-pressed="${t.done}"
          aria-label="${esc(t.text)}">${checkSvg}</button>
        <span class="item-text" data-act="edittask" data-d="${wi}" data-r="${row}">${esc(t.text)}</span></li>` : '').join('');
    if (firstEmpty >= 0) {
      html += `<li class="add-row"><input type="text" maxlength="120" placeholder="＋ Add a task" enterkeyhint="done"
        data-act="addtask" data-d="${wi}" data-r="${firstEmpty}"></li>`;
    }
    html += '</ul>';
    if (!tasks.some(t => t.text) && firstEmpty < 0) html = '<div class="empty">No tasks.</div>';
    return html;
  }

  function wellnessCard(m, day) {
    const mood = m.mood[day - 1], sleep = m.sleep[day - 1];
    return `<section class="card"><div class="card-h"><h2>How do you feel?</h2><span class="muted small">Mood 1–10</span></div>
      <div class="scale">${Array.from({length: 10}, (_, i) => `<button class="${mood === i + 1 ? 'sel' : ''}"
        data-act="mood" data-month="${m.idx}" data-day="${day}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="card-h" style="margin:14px 0 6px"><h2>Hours of sleep</h2>${S.state.hasOura ? '<span class="pill">💍 auto from Oura</span>' : ''}</div>
      <div class="stepper"><button data-act="sleep" data-month="${m.idx}" data-day="${day}" data-delta="-0.5" aria-label="Less sleep">−</button>
        <b>${sleep === '' || sleep === undefined ? '–' : sleep + ' h'}</b>
        <button data-act="sleep" data-month="${m.idx}" data-day="${day}" data-delta="0.5" aria-label="More sleep">+</button></div>
    </section>`;
  }

  function ouraCard(st, day) {
    const o = st.month.oura;
    const pick = arr => { for (let d = day - 1; d >= 0; d--) if (arr[d] !== '' && arr[d] !== undefined) return arr[d]; return '–'; };
    return `<section class="card"><div class="card-h"><h2>💍 Oura</h2>
      <button class="btn small ghost" data-act="oura">Sync now</button></div>
      <div class="kv"><div><b>${pick(o.sleepScore)}</b><span class="small muted">Sleep score</span></div>
        <div><b>${pick(o.readiness)}</b><span class="small muted">Readiness</span></div>
        <div><b>${typeof pick(o.steps) === 'number' ? fmt(pick(o.steps)) : '–'}</b><span class="small muted">Steps</span></div></div>
      <p class="small muted" style="margin:10px 0 0">${esc(st.oura && st.oura.status)}</p></section>`;
  }

  // ---------------------------------------------------------------- Week
  function weekView() {
    const w = S.state.week, t = today();
    const ti = weekIdxOf(t);
    if (S.weekDay === null) S.weekDay = ti === null ? 0 : ti;
    const start = parseIso(w.start);
    let html = `<div class="date-h">This week<small>${start.toLocaleDateString(undefined, {day: 'numeric', month: 'short'})} –
      ${new Date(start.getTime() + 6 * 864e5).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</small></div>`;
    html += `<section class="card"><div class="row">${ring(w.score, 92)}<div class="grow">
      <div class="small muted">Weekly score</div><div class="big">${w.done}<span class="muted" style="font-size:16px"> / ${w.total} tasks</span></div>
      <div class="small">🎯 <span data-act="weekfield" data-f="goal">${esc(w.goal) || '<span class="muted">Set a weekly goal</span>'}</span></div>
      <div class="small">🎁 <span data-act="weekfield" data-f="reward">${esc(w.reward) || '<span class="muted">Set a reward</span>'}</span></div>
      </div></div>${w.quote ? `<p class="small muted" style="margin:10px 0 0" data-act="weekfield" data-f="quote">“${esc(w.quote)}”</p>` : ''}</section>`;
    html += '<div class="chips" style="margin-bottom:12px">' + w.days.map((d, i) => {
      const date = new Date(start.getTime() + i * 864e5);
      return `<button class="chip ${i === S.weekDay ? 'sel' : ''} ${i === ti ? 'is-today' : ''}" data-act="weekday" data-d="${i}">
        ${DAYS[i].slice(0, 3)}<b>${date.getDate()}</b>${d.done + d.left ? pct(d.pct) : '–'}</button>`;
    }).join('') + '</div>';
    const d = w.days[S.weekDay];
    html += `<section class="card"><div class="card-h"><h2>${DAYS[S.weekDay]} 🌱</h2><span class="pill">${d.done}/${d.done + d.left}</span></div>
      ${taskList(S.weekDay)}</section>`;
    if (w.habits.length) {
      html += `<section class="card"><div class="card-h"><h2>Weekly habits</h2></div><div class="grid-wrap"><table class="hgrid">
        <tr><th class="name"></th>${DAYS.map((n, i) => `<th class="${i === ti ? 'today' : ''}">${n[0]}</th>`).join('')}</tr>` +
        w.habits.map(h => `<tr><td class="name">${esc(h.name)}</td>${h.ticks.map((on, i) => `<td class="c ${i === ti ? 'today' : ''}">
          <button class="${on ? 'on' : ''}" data-act="whabit" data-h="${h.idx}" data-d="${i}" aria-pressed="${on}"
          aria-label="${esc(h.name)} ${DAYS[i]}"></button></td>`).join('')}</tr>`).join('') + '</table></div></section>';
    }
    html += `<button class="btn ghost" style="width:100%" data-act="newweek">💾 Bank XP & start a new week</button>`;
    return html;
  }

  // ---------------------------------------------------------------- Month
  function monthView() {
    const m = S.monthView || S.state.month, st = S.state, t = today();
    const isCur = t.getFullYear() === st.year && t.getMonth() === m.idx;
    let html = `<div class="row" style="margin:2px 0 12px"><button class="btn small ghost" data-act="month" data-dir="-1" ${m.idx === 0 ? 'disabled' : ''}>‹</button>
      <div class="grow" style="text-align:center;font-size:20px;font-weight:700">${esc(m.name)} ${st.year}</div>
      <button class="btn small ghost" data-act="month" data-dir="1" ${m.idx === 11 ? 'disabled' : ''}>›</button></div>`;
    html += `<section class="card"><div class="row">${ring(m.pct, 92)}<div class="grow kv">
      <div><b>${fmt(m.goal)}</b><span class="small muted">Goal</span></div><div><b>${fmt(m.done)}</b><span class="small muted">Done</span></div>
      <div><b>${fmt(m.left)}</b><span class="small muted">Left</span></div></div></div>
      <div class="bars" style="margin-top:12px;height:70px">${m.dayPct.map((p, i) =>
        `<span class="${isCur && i === t.getDate() - 1 ? 'today' : ''}" style="height:${Math.max(2, num(p) * 100)}%"></span>`).join('')}</div>
      <div class="bar-labels"><span>1</span><span style="flex:${m.days - 2}"></span><span>${m.days}</span></div></section>`;
    html += `<section class="card"><div class="card-h"><h2>Habits</h2><span class="small muted">tap to tick</span></div>
      <div class="grid-wrap"><table class="hgrid"><tr><th class="name"></th>${m.dayNames.map((n, i) =>
        `<th class="${isCur && i === t.getDate() - 1 ? 'today' : ''}">${esc(n)}<br>${i + 1}</th>`).join('')}</tr>` +
      m.habits.map(h => `<tr><td class="name" title="${esc(h.name)}">${esc(h.name)}</td>${h.ticks.map((on, i) => {
        const future = isCur ? i > t.getDate() - 1 : (st.year > t.getFullYear() || (st.year === t.getFullYear() && m.idx > t.getMonth()));
        return `<td class="c ${isCur && i === t.getDate() - 1 ? 'today' : ''} ${future ? 'future' : ''}"><button class="${on ? 'on' : ''}"
          data-act="habit" data-month="${m.idx}" data-h="${h.idx}" data-day="${i + 1}" aria-pressed="${on}"
          aria-label="${esc(h.name)} ${i + 1}"></button></td>`;
      }).join('')}</tr>`).join('') + '</table></div></section>';
    html += '<section class="card"><div class="card-h"><h2>Analysis</h2></div><table class="simple">' +
      m.habits.map(h => `<tr><td>${esc(h.name)}<div style="margin-top:4px">${hbar(h.pct)}</div></td>
        <td class="n">${num(h.actual)}/${num(h.goal)}<br><b>${pct(h.pct)}</b></td></tr>`).join('') + '</table></section>';
    if (m.top10.length) html += `<section class="card"><div class="card-h"><h2>🏆 Top 10 habits</h2></div>
      <ol class="top">${m.top10.map(n => `<li>${esc(n)}</li>`).join('')}</ol></section>`;
    return html;
  }

  // ---------------------------------------------------------------- Year
  function yearView() {
    const st = S.state, d = st.dashboard, t = today();
    let html = `<div class="date-h">${st.year}<small>Annual dashboard</small></div>`;
    html += `<section class="card"><div class="row">${ring(d.year.pct, 92)}<div class="grow kv">
      <div><b>${fmt(d.year.goal)}</b><span class="small muted">Goal</span></div><div><b>${fmt(d.year.done)}</b><span class="small muted">Done</span></div>
      <div><b>${fmt(num(d.year.goal) - num(d.year.done))}</b><span class="small muted">Left</span></div></div></div>
      <p class="small muted" style="margin:8px 0 0">Counts the months you've started.</p></section>`;
    html += `<section class="card"><div class="card-h"><h2>Monthly progress</h2></div><div class="bars">${d.months.map((x, i) =>
      `<span class="${st.year === t.getFullYear() && i === t.getMonth() ? 'today' : ''}" style="height:${Math.max(2, num(x.pct) * 100)}%"
        title="${MON[i]} ${pct(x.pct)}"></span>`).join('')}</div>
      <div class="bar-labels">${MON.map(n => `<span>${n[0]}</span>`).join('')}</div></section>`;
    html += '<section class="card"><div class="card-h"><h2>Habits this year</h2></div><table class="simple">' +
      d.habits.map(h => `<tr><td>${esc(h.name)}<div style="margin-top:4px">${hbar(h.pct)}</div></td>
        <td class="n">${num(h.actual)}<br><b>${pct(h.pct)}</b></td></tr>`).join('') + '</table></section>';
    if (d.top10.length) html += `<section class="card"><div class="card-h"><h2>🏆 Top 10 – year</h2></div>
      <ol class="top">${d.top10.map(n => `<li>${esc(n)}</li>`).join('')}</ol></section>`;
    const rows = d.months.map((x, i) => [x, i]).filter(([x]) => x.mood !== '' || x.sleep !== '');
    if (rows.length) html += '<section class="card"><div class="card-h"><h2>Wellness</h2><span class="small muted">monthly average</span></div>' +
      '<table class="simple"><tr><td class="muted small">Month</td><td class="n muted small">Mood</td><td class="n muted small">Sleep</td></tr>' +
      rows.map(([x, i]) => `<tr><td>${MON[i]}</td><td class="n">${x.mood === '' ? '–' : num(x.mood).toFixed(1)}</td>
        <td class="n">${x.sleep === '' ? '–' : num(x.sleep).toFixed(1) + ' h'}</td></tr>`).join('') + '</table></section>';
    return html;
  }

  // ---------------------------------------------------------------- Hero
  function heroView() {
    const ch = S.state.character;
    const maxPts = Math.max(1, ...ch.stats.map(s => num(s.points)));
    let html = heroCard(ch, true);
    html += `<section class="card"><div class="card-h"><h2>Class</h2>
      <button class="btn small ghost" data-act="rename">✎ ${esc(ch.name || 'Set name')}</button></div>
      <div class="classes">${ch.classes.map((c, i) => `<button class="${c === ch.cls ? 'sel' : ''}" data-act="cls" data-c="${esc(c)}">
        <span>${ch.classIcons[i]}</span>${esc(c)}</button>`).join('')}</div></section>`;
    html += `<section class="card"><div class="card-h"><h2>🧬 Evolution path</h2></div><div class="evo">${ch.evolution.map(e =>
      `<div class="${e.current ? 'cur' : e.unlocked ? '' : 'lock'}"><span class="av">${esc(e.avatar)}</span>${esc(e.title)}<br>
        <span class="small">${e.unlocked ? '✅' : '🔒'} Lv ${e.level}</span></div>`).join('')}</div></section>`;
    html += `<section class="card"><div class="card-h"><h2>Stats</h2></div><table class="simple">${ch.stats.map(s =>
      `<tr><td style="width:44%">${s.icon} ${esc(s.name)}</td><td>${hbar(num(s.points) / maxPts)}</td>
        <td class="n"><b>Lv ${num(s.lv)}</b><br><span class="small muted">${fmt(s.points)}</span></td></tr>`).join('')}</table></section>`;
    html += `<section class="card"><div class="card-h"><h2>🏅 Achievements</h2>
      <span class="pill">${ch.badges.filter(b => b.unlocked).length}/${ch.badges.length}</span></div>
      <div class="badges">${ch.badges.map(b => `<div class="badge ${b.unlocked ? '' : 'locked'}"><div class="ic">${b.unlocked ? b.icon : '🔒'}</div>
        <b>${esc(b.name)}</b><small>${esc(b.req)}</small></div>`).join('')}</div></section>`;
    html += `<section class="card"><div class="card-h"><h2>XP breakdown</h2></div><table class="simple">${ch.xpBreakdown.map(r =>
      `<tr><td>${esc(r.label)}</td><td class="n muted">${fmt(r.count)}×</td><td class="n"><b>${fmt(r.xp)}</b></td></tr>`).join('')}
      <tr class="total"><td>Total XP</td><td></td><td class="n">${fmt(ch.xp)}</td></tr></table></section>`;
    return html;
  }

  // ---------------------------------------------------------------- Settings
  function settingsView() {
    const c = S.config || {};
    return `<div class="date-h">Settings<small>Connect this device to your HABIT GAME sheet</small></div>
      <section class="card"><label class="field"><span>Web app URL</span>
        <input id="cfg-url" type="url" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec"
          value="${esc(c.demo ? '' : c.url || '')}"></label>
      <label class="field"><span>Website key</span>
        <input id="cfg-key" type="password" autocomplete="off" placeholder="from 🌐 Website → Show website key" value="${esc(c.demo ? '' : c.key || '')}"></label>
      <div class="row"><button class="btn" data-act="connect">Save & connect</button>
        <button class="btn ghost" data-act="demo">Try the demo</button></div>
      ${S.config ? `<p class="small muted">${c.demo ? 'Demo mode – changes are not saved.' : 'Connected.'}
        ${S.error ? '<br><b style="color:var(--danger)">' + esc(S.error) + '</b>' : ''}</p>
        <button class="btn small ghost" data-act="disconnect">Disconnect this device</button>` : ''}</section>
      <section class="card"><div class="card-h"><h2>One-time setup</h2></div><ol class="steps small">
        <li>Open your HABIT GAME Google Sheet → <b>Extensions → Apps Script</b>.</li>
        <li>Delete everything in <code>Code.gs</code>, paste the whole <code>HabitGame_AllInOne.gs</code> script, save, then reload the sheet.</li>
        <li>Menu <b>Habit Game → Set up checkboxes</b> and allow the permissions (Advanced → Go to … → Allow).</li>
        <li>Menu <b>🌐 Website → Create website key</b>.</li>
        <li>In Apps Script: <b>Deploy → New deployment → Web app</b>, Execute as <b>Me</b>, Who has access <b>Anyone</b> → Deploy. Copy the URL.</li>
        <li>Paste the URL and key above on each device. Tip: <b>Share → Add to Home Screen</b> makes it feel like an app.</li></ol>
        <p class="small muted">Your data stays in your Google Sheet. The URL and key are stored only on this device – keep them private.</p></section>`;
  }

  // ---------------------------------------------------------------- actions
  function onClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const a = el.dataset.act, st = S.state;
    const xpPer = st && st.character.xpPer || {habit: 10, task: 15, weeklyHabit: 5};
    switch (a) {
      case 'habit': {
        const mi = +el.dataset.month, h = +el.dataset.h, day = +el.dataset.day;
        const months = [st.month, S.monthView].filter((x, i, arr) => x && x.idx === mi && arr.indexOf(x) === i);
        let value = null;
        months.forEach(m => {
          const hab = m.habits.find(x => x.idx === h);
          if (value === null) value = !hab.ticks[day - 1];
          hab.ticks[day - 1] = value;
          hab.actual = num(hab.actual) + (value ? 1 : -1);
          hab.pct = num(hab.goal) ? hab.actual / hab.goal : 0;
          m.done = num(m.done) + (value ? 1 : -1); m.left = num(m.goal) - m.done; m.pct = num(m.goal) ? m.done / m.goal : 0;
          const n = m.habits.length; m.dayPct[day - 1] = n ? m.habits.filter(x => x.ticks[day - 1]).length / n : 0;
        });
        bumpXp(value ? num(xpPer.habit) : -num(xpPer.habit));
        if (value) floatXp(el, num(xpPer.habit));
        if (navigator.vibrate) navigator.vibrate(8);
        render();
        send({action: 'tickHabit', month: mi, habit: h, day: day, value: value});
        return;
      }
      case 'task': {
        const d = +el.dataset.d, r = +el.dataset.r, day = st.week.days[d], task = day.tasks[r];
        task.done = !task.done;
        day.done += task.done ? 1 : -1; day.left -= task.done ? 1 : -1;
        day.pct = day.done + day.left ? day.done / (day.done + day.left) : 0;
        st.week.done += task.done ? 1 : -1; st.week.score = st.week.total ? st.week.done / st.week.total : 0;
        bumpXp(task.done ? num(xpPer.task) : -num(xpPer.task));
        if (task.done) floatXp(el, num(xpPer.task));
        if (navigator.vibrate) navigator.vibrate(8);
        render();
        send({action: 'tickTask', dayIdx: d, row: r, value: task.done, month: currentMonthIdx(st)});
        return;
      }
      case 'whabit': {
        const h = st.week.habits.find(x => x.idx === +el.dataset.h), d = +el.dataset.d;
        h.ticks[d] = !h.ticks[d];
        bumpXp(h.ticks[d] ? num(xpPer.weeklyHabit) : -num(xpPer.weeklyHabit));
        if (h.ticks[d]) floatXp(el, num(xpPer.weeklyHabit));
        render();
        send({action: 'tickWeekHabit', habit: h.idx, dayIdx: d, value: h.ticks[d], month: currentMonthIdx(st)});
        return;
      }
      case 'edittask': {
        const d = +el.dataset.d, r = +el.dataset.r, task = st.week.days[d].tasks[r];
        const text = prompt('Edit task (empty to delete)', task.text);
        if (text === null) return;
        setTask(d, r, text.trim());
        return;
      }
      case 'weekfield': {
        const f = el.dataset.f;
        const v = prompt({goal: 'Weekly goal', reward: 'Reward', quote: 'Weekly quote'}[f], st.week[f] || '');
        if (v === null) return;
        st.week[f] = v.trim();
        render();
        send({action: 'setWeekField', field: f, value: v.trim(), month: currentMonthIdx(st)});
        return;
      }
      case 'weekday': S.weekDay = +el.dataset.d; render(); return;
      case 'mood': {
        const m = st.month, day = +el.dataset.day, v = +el.dataset.v;
        m.mood[day - 1] = m.mood[day - 1] === v ? '' : v;
        render();
        send({action: 'wellness', month: m.idx, day: day, field: 'mood', value: m.mood[day - 1]});
        return;
      }
      case 'sleep': {
        const m = st.month, day = +el.dataset.day, cur = m.sleep[day - 1];
        const base = cur === '' || cur === undefined ? 7 : num(cur);
        const v = Math.max(0, Math.min(24, (cur === '' || cur === undefined ? base : base + Number(el.dataset.delta))));
        m.sleep[day - 1] = v;
        render();
        send({action: 'wellness', month: m.idx, day: day, field: 'sleep', value: v});
        return;
      }
      case 'month': {
        const idx = (S.monthView || st.month).idx + Number(el.dataset.dir);
        if (idx < 0 || idx > 11) return;
        if (idx === st.month.idx) { S.monthView = st.month; render(); return; }
        S.monthView = Object.assign({}, S.monthView, {idx: idx, name: '…', habits: [], dayPct: [], dayNames: [], top10: []});
        render();
        refresh(idx).then(() => render());
        return;
      }
      case 'newweek':
        if (!confirm('Bank this week\'s XP in the Weekly Log, clear the planner and move to next week?')) return;
        toast('Starting a new week…');
        S.weekDay = null;
        send({action: 'startNewWeek', month: currentMonthIdx(st)});
        return;
      case 'oura': toast('Syncing Oura…'); send({action: 'syncOura', month: currentMonthIdx(st)}); return;
      case 'cls':
        st.character.cls = el.dataset.c; render();
        send({action: 'setPlayer', cls: el.dataset.c, month: currentMonthIdx(st)});
        return;
      case 'rename': {
        const n = prompt('Player name', st.character.name || '');
        if (n === null) return;
        st.character.name = n.trim(); render();
        send({action: 'setPlayer', name: n.trim(), month: currentMonthIdx(st)});
        return;
      }
      case 'retry': refresh(); return;
      case 'connect': {
        const url = $('#cfg-url').value.trim(), key = $('#cfg-key').value.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('Paste the Apps Script web app URL (…/exec)'); return; }
        if (!key) { toast('Paste your website key'); return; }
        connect({url: url, key: key});
        return;
      }
      case 'demo': connect({demo: true}); return;
      case 'disconnect':
        S.config = null; S.state = null; S.monthView = null;
        store.del('hg.config'); store.del('hg.state');
        render();
        return;
    }
  }

  function setTask(d, r, text) {
    const st = S.state, day = st.week.days[d], task = day.tasks[r];
    const had = !!task.text;
    if (had && !text && task.done) { day.done--; st.week.done--; }
    if (had && !text) { st.week.total--; if (!task.done) day.left--; }
    if (!had && text) { st.week.total++; day.left++; }
    task.text = text; if (!text) task.done = false;
    day.pct = day.done + day.left ? day.done / (day.done + day.left) : 0;
    st.week.score = st.week.total ? st.week.done / st.week.total : 0;
    render();
    send({action: 'setTask', dayIdx: d, row: r, text: text, month: currentMonthIdx(st)});
  }

  function onKey(e) {
    const el = e.target;
    if (el.dataset && el.dataset.act === 'addtask' && e.key === 'Enter' && el.value.trim()) {
      setTask(+el.dataset.d, +el.dataset.r, el.value.trim());
      setTimeout(() => { const next = document.querySelector('[data-act="addtask"]'); if (next) next.focus(); }, 30);
    }
  }

  function connect(cfg) {
    S.config = cfg; S.state = null; S.monthView = null; S.error = null;
    store.set('hg.config', cfg); store.del('hg.state');
    go('today');
    refresh().then(() => { if (S.state) toast(cfg.demo ? '🎮 Demo loaded' : '✅ Connected to your sheet'); });
  }

  function go(view) {
    S.view = VIEWS.indexOf(view) >= 0 ? view : 'today';
    if (S.view === 'month' && S.state && !S.monthView) S.monthView = S.state.month;
    history.replaceState(null, '', '#' + S.view);
    render();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- start
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.pending === 0) refresh();
  });
  window.addEventListener('online', () => refresh());
  setInterval(() => {
    if (document.visibilityState === 'visible' && S.pending === 0 && S.config && !S.config.demo) refresh();
  }, REFRESH_MS);
  if (S.state) S.monthView = S.state.month;
  render();
  refresh();
})();
