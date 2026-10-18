// Demo backend: same request/response shape as WebApi.gs, kept in memory with sample data.
// Lets the site be explored (and tested) without connecting a Google Sheet.
(function () {
  'use strict';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                  'September', 'October', 'November', 'December'];
  const DAYN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const CLASSES = ['Warrior', 'Mage', 'Ninja', 'Monk'];
  const CLASS_ICONS = ['⚔️', '🧙', '🥷', '🧘'];
  const TIER_LEVELS = [1, 5, 10, 20, 30, 40, 50];
  const TIERS = {
    Warrior: [['🧑🪵', 'Recruit'], ['🧑🗡️', 'Squire'], ['🛡️⚔️', 'Knight'], ['🏇', 'Cavalier'],
              ['🦁⚔️', 'Champion'], ['🐉🗡️', 'Dragon Slayer'], ['👑⚔️', 'Warrior King']],
    Mage: [['🧑📖', 'Novice'], ['🕯️📜', 'Apprentice'], ['🔮', 'Sorcerer'], ['🧙', 'Wizard'],
           ['⚡🧙', 'Archmage'], ['🌌🔮', 'Astral Sage'], ['👑🧙', 'Grand Magus']],
    Ninja: [['🧑🥋', 'Trainee'], ['🥋', 'Student'], ['🥷', 'Shinobi'], ['🗡️🥷', 'Shadow'],
            ['🌑🥷', 'Phantom'], ['🐲🥷', 'Grandmaster'], ['👑🥷', 'Shogun']],
    Monk: [['🧑🍵', 'Seeker'], ['🍵🧘', 'Initiate'], ['🧘', 'Monk'], ['📿🧘', 'Master'],
           ['☯️', 'Enlightened'], ['🪷', 'Lotus Sage'], ['👑🧘', 'Ascended']],
  };
  const HABITS = ['Wake up at 05:00 ⏰', 'Gym 💪', 'Reading / Learning 📖', 'Day Planning 📅',
                  'No Alcohol 🍾', 'Project Work 🎯', 'Social Media Detox 🌿', 'Goal Journaling 📓',
                  'Cold Shower 🚿', 'Meditation 🧘', 'Stretching 🤸', 'Sleep 7h+ 😴'];
  const STAT_OF = ['Discipline', 'Strength', 'Intelligence', 'Focus', 'Vitality', 'Focus', 'Focus',
                   'Intelligence', 'Vitality', 'Focus', 'Strength', 'Vitality'];
  const STATS = [['Strength', '💪'], ['Intelligence', '🧠'], ['Focus', '🎯'], ['Discipline', '🛡️'],
                 ['Vitality', '❤️']];
  const BADGES = [['🌱', 'First Step', 'Tick your first habit'], ['💯', 'Century', '100 habit ticks'],
    ['🏆', 'Habit Machine', '1,000 habit ticks'], ['⭐', 'Perfect Day', 'Every habit done in one day'],
    ['🔥', 'On Fire', '7-day streak'], ['🌋', 'Unstoppable', '30-day streak'],
    ['⚔️', 'Task Slayer', '50 tasks completed'], ['👑', 'Perfect Week', 'Weekly Score of 100%'],
    ['🥇', 'Elite Month', 'A month at 90% or more'], ['🎖️', 'Rising Star', 'Reach Level 10'],
    ['🏅', 'Veteran', 'Reach Level 25'], ['💎', 'Legend', 'Reach Level 50']];
  const TASKS = [['Gym session', 'Write 10 content ideas', 'Buy vitamins', 'Cook a healthy meal'],
    ['Client meeting', 'Redesign website', 'Send email to client'], ['Grocery shopping', 'Check emails', 'Plan workout routine'],
    ['Reply to DMs', 'Create ad creatives', 'Call mum'], ['Doctor appointment', 'Edit youtube video', 'Book flights'],
    ['Sauna + Gym', 'Haircut appointment', 'Call grandparents'], ['Meal prep', 'Plan next week', 'Read 30 pages']];

  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = new Date();
  const year = now.getFullYear();
  const pad = n => String(n).padStart(2, '0');
  const todayIso = iso(now);
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  const daysIn = m => new Date(year, m + 1, 0).getDate();
  const rates = HABITS.map(() => 0.55 + rnd() * 0.4);

  // ticks[m][h][d] for months up to today
  const ticks = MONTHS.map((_, m) => HABITS.map((__, h) => Array.from({length: daysIn(m)}, (___, d) => {
    const date = new Date(year, m, d + 1);
    return date < new Date(year, now.getMonth(), now.getDate()) && rnd() < rates[h];
  })));
  const mood = MONTHS.map((_, m) => Array.from({length: daysIn(m)}, (__, d) =>
    new Date(year, m, d + 1) < now ? 4 + Math.floor(rnd() * 6) : ''));
  const sleep = MONTHS.map((_, m) => Array.from({length: daysIn(m)}, (__, d) =>
    new Date(year, m, d + 1) < now ? Math.round((5.5 + rnd() * 3) * 2) / 2 : ''));
  const oura = MONTHS.map((_, m) => ({
    sleepScore: Array.from({length: daysIn(m)}, (__, d) => new Date(year, m, d + 1) <= now ? 60 + Math.floor(rnd() * 35) : ''),
    readiness: Array.from({length: daysIn(m)}, (__, d) => new Date(year, m, d + 1) <= now ? 62 + Math.floor(rnd() * 33) : ''),
    steps: Array.from({length: daysIn(m)}, (__, d) => new Date(year, m, d + 1) <= now ? 4000 + Math.floor(rnd() * 11000) : ''),
  }));

  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = {
    start: iso(monday), goal: 'Gym 5x', reward: 'Cheat meal', quote: 'Discipline today, freedom tomorrow',
    days: TASKS.map((list, d) => {
      const date = new Date(monday); date.setDate(monday.getDate() + d);
      return Array.from({length: 10}, (_, t) => ({text: list[t] || '', done: !!list[t] && date < now && rnd() < 0.8}));
    }),
    habits: ['Drink 2L of water 💧', 'Read 10 pages 📖', 'No smoking 🚭', 'Stretching 🤸'].map(n => ({
      name: n, ticks: Array.from({length: 7}, (_, d) => { const dt = new Date(monday); dt.setDate(monday.getDate() + d); return dt < now && rnd() < 0.8; }),
    })),
  };
  const player = {name: 'Habit Hero', cls: 'Ninja'};
  const log = {tasks: 141, weekHabits: 160, perfectWeeks: 1};
  const XP = {habit: 10, task: 15, weeklyHabit: 5, perfectDay: 50, streak: 100, perfectWeek: 200, oura: 25};
  const cum = lv => 100 * (lv - 1) + 50 * (lv - 1) * (lv - 2) / 2;

  function dayStats() {   // one entry per day of the year up to today
    const out = [];
    MONTHS.forEach((_, m) => { for (let d = 0; d < daysIn(m); d++) {
      const n = HABITS.length, c = ticks[m].reduce((a, h) => a + (h[d] ? 1 : 0), 0);
      out.push({pct: c / n, perfect: c === n, ready: Number(oura[m].readiness[d]) || 0});
    } });
    return out;
  }

  function state(mIdx) {
    if (mIdx === null || mIdx === undefined || mIdx === '') mIdx = now.getMonth();
    const days = dayStats();
    let streak = 0, best = 0, milestones = 0, run = 0, prevRun = 0;
    const todayN = Math.floor((new Date(year, now.getMonth(), now.getDate()) - new Date(year, 0, 1)) / 864e5);
    days.forEach((d, i) => {
      run = d.pct >= 0.5 ? run + 1 : 0; best = Math.max(best, run);
      if (run > 0 && run % 7 === 0) milestones++;
      if (i === todayN) streak = run || (i > 0 ? prevRun : 0);
      prevRun = run;
    });
    const habitTicks = ticks.reduce((a, m) => a + m.reduce((b, h) => b + h.filter(Boolean).length, 0), 0);
    const perfectDays = days.filter(d => d.perfect).length;
    const ouraDays = days.filter(d => d.ready >= 85).length;
    const wDone = week.days.reduce((a, d) => a + d.filter(t => t.text && t.done).length, 0);
    const wTotal = week.days.reduce((a, d) => a + d.filter(t => t.text).length, 0);
    const wHab = week.habits.reduce((a, h) => a + h.ticks.filter(Boolean).length, 0);
    const perfectWeeks = log.perfectWeeks + (wTotal && wDone === wTotal ? 1 : 0);
    const xpRows = [
      ['✅ Habit ticks (month tabs)', habitTicks, XP.habit], ['📝 Tasks done – this week', wDone, XP.task],
      ['📝 Tasks done – Weekly Log', log.tasks, XP.task], ['📅 Weekly habit ticks – this week', wHab, XP.weeklyHabit],
      ['📅 Weekly habit ticks – Weekly Log', log.weekHabits, XP.weeklyHabit], ['⭐ Perfect days', perfectDays, XP.perfectDay],
      ['🔥 Streak milestones (7 days)', milestones, XP.streak], ['👑 Perfect weeks', perfectWeeks, XP.perfectWeek],
      ['💍 Oura Readiness bonus days', ouraDays, XP.oura]].map(([label, count, each]) => ({label, count, xp: count * each}));
    const xp = xpRows.reduce((a, r) => a + r.xp, 0);
    let level = 1; while (level < 50 && cum(level + 1) <= xp) level++;
    const start = cum(level), next = cum(Math.min(50, level + 1));
    const tier = TIER_LEVELS.filter(l => level >= l).length;
    const tl = TIERS[player.cls];
    const actual = HABITS.map((_, h) => ticks.reduce((a, m) => a + m[h].filter(Boolean).length, 0));
    const statPts = STATS.map(([s]) => HABITS.reduce((a, _, h) => a + (STAT_OF[h] === s ? actual[h] : 0), 0)
                                      + (s === 'Vitality' ? ouraDays : 0));
    const monthSum = MONTHS.map((_, m) => {
      const goal = HABITS.length * daysIn(m), done = ticks[m].reduce((a, h) => a + h.filter(Boolean).length, 0);
      const avg = a => { const v = a.filter(x => x !== ''); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : ''; };
      return {goal, done, pct: done / goal, mood: avg(mood[m]), sleep: avg(sleep[m])};
    });
    const active = monthSum.filter(x => x.done > 0);
    const activeDays = MONTHS.reduce((a, _, i) => a + (monthSum[i].done > 0 ? daysIn(i) : 0), 0);
    const yGoal = active.reduce((a, x) => a + x.goal, 0), yDone = monthSum.reduce((a, x) => a + x.done, 0);
    const conds = [habitTicks >= 1, habitTicks >= 100, habitTicks >= 1000, perfectDays >= 1, best >= 7, best >= 30,
                   wDone + log.tasks >= 50, perfectWeeks >= 1, Math.max(...monthSum.map(x => x.pct)) >= 0.9,
                   level >= 10, level >= 25, level >= 50];
    const rank = list => list.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, 10).map(x => HABITS[x[1]]);
    const m = mIdx, dIn = daysIn(m);
    const mDone = monthSum[m].done;
    const mActual = HABITS.map((_, h) => ticks[m][h].filter(Boolean).length);
    return {
      year, today: todayIso, hasOura: true,
      character: {
        name: player.name, cls: player.cls, classes: CLASSES, classIcons: CLASS_ICONS, level, maxLevel: 50,
        xp, levelStartXp: start, nextLevelXp: next, pct: level >= 50 ? 1 : (xp - start) / (next - start),
        avatar: tl[tier - 1][0], title: tl[tier - 1][1], xpPer: {habit: XP.habit, task: XP.task, weeklyHabit: XP.weeklyHabit},
        streak, bestStreak: best, perfectDays, ouraDays, xpBreakdown: xpRows,
        stats: STATS.map(([name, icon], i) => ({name, icon, points: statPts[i], lv: Math.floor(statPts[i] / 25) + 1})),
        badges: BADGES.map(([icon, name, req], i) => ({icon, name, req, unlocked: conds[i]})),
        evolution: TIER_LEVELS.map((lv, t) => ({level: lv, avatar: tl[t][0], title: tl[t][1], unlocked: level >= lv, current: t === tier - 1})),
      },
      dashboard: {
        months: monthSum, year: {goal: yGoal, done: yDone, pct: yGoal ? yDone / yGoal : 0},
        habits: HABITS.map((name, h) => ({name, goal: activeDays, actual: actual[h], pct: actual[h] / Math.max(1, activeDays)})),
        top10: rank(actual),
      },
      month: {
        idx: m, name: MONTHS[m], days: dIn,
        dayNames: Array.from({length: dIn}, (_, d) => DAYN[new Date(year, m, d + 1).getDay()]),
        dayPct: Array.from({length: dIn}, (_, d) => ticks[m].reduce((a, h) => a + (h[d] ? 1 : 0), 0) / HABITS.length),
        habits: HABITS.map((name, h) => ({idx: h, name, ticks: ticks[m][h].slice(), goal: dIn, actual: mActual[h], pct: mActual[h] / dIn})),
        goal: monthSum[m].goal, done: mDone, left: monthSum[m].goal - mDone, pct: monthSum[m].pct,
        mood: mood[m].slice(), sleep: sleep[m].slice(),
        oura: {sleepScore: oura[m].sleepScore.slice(), readiness: oura[m].readiness.slice(), steps: oura[m].steps.slice()},
        top10: rank(mActual),
      },
      week: {
        start: week.start, goal: week.goal, reward: week.reward, quote: week.quote,
        days: week.days.map(list => {
          const done = list.filter(t => t.text && t.done).length, tot = list.filter(t => t.text).length;
          return {tasks: list.map(t => ({...t})), done, left: tot - done, pct: tot ? done / tot : 0};
        }),
        done: wDone, total: wTotal, score: wTotal ? wDone / wTotal : 0,
        habits: week.habits.map((h, i) => ({idx: i, name: h.name, ticks: h.ticks.slice()})),
      },
      oura: {status: 'Demo · last sync ' + todayIso},
    };
  }

  function apply(req) {
    switch (req.action) {
      case 'tickHabit': ticks[req.month][req.habit][req.day - 1] = req.value === true; break;
      case 'wellness': (req.field === 'mood' ? mood : sleep)[req.month][req.day - 1] = req.value === '' ? '' : Number(req.value); break;
      case 'tickTask': week.days[req.dayIdx][req.row].done = req.value === true; break;
      case 'setTask': week.days[req.dayIdx][req.row] = {text: req.text, done: req.text ? week.days[req.dayIdx][req.row].done : false}; break;
      case 'tickWeekHabit': week.habits[req.habit].ticks[req.dayIdx] = req.value === true; break;
      case 'setWeekField': week[req.field] = req.value; break;
      case 'setPlayer': if (req.name !== undefined) player.name = req.name; if (req.cls) player.cls = req.cls; break;
      case 'startNewWeek': {
        const s = state(null).week;
        log.tasks += s.done; log.weekHabits += s.habits.reduce((a, h) => a + h.ticks.filter(Boolean).length, 0);
        if (s.total && s.done === s.total) log.perfectWeeks++;
        const d = new Date(week.start); d.setDate(d.getDate() + 7); week.start = iso(d);
        week.days = week.days.map(() => Array.from({length: 10}, () => ({text: '', done: false})));
        week.habits.forEach(h => { h.ticks = Array(7).fill(false); });
        break;
      }
      case 'syncOura': break;
      default: throw new Error('unknown action');
    }
  }

  window.HabitGameDemo = {
    request(req) {
      return new Promise(resolve => setTimeout(() => {
        try {
          if (req.action && req.action !== 'state') apply(req);
          resolve({ok: true, state: state(req.month)});
        } catch (e) { resolve({ok: false, error: e.message}); }
      }, 250));
    },
  };
})();
