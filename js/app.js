// Month Ahead — UI. Renders views into #view from the saved state.
import * as C from './calc.js';
import * as S from './store.js';

export const APP_VERSION = '1.1.0';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (n) => (n == null ? '' : String(n));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let state = S.emptyState();
const ui = {
  reward: null, // last check-in reward, shown once
  monthlyResult: null,
  setupStep: 0,
  draft: null,
  swReg: null,
  updateReady: false,
  applyingUpdate: false,
  installEvt: null,
  pendingRestore: null,
  persisted: null,
  editWeek: null,
};

async function commit(fn) {
  fn(state);
  try { await S.save(state); }
  catch { toast('Could not save on this device. Storage may be full or blocked.'); }
}

// ---------- Icons (inline SVG, decorative) ----------
const I = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  bills: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  growth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/><path d="M15 7h5v5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-5.9-4.2-8.2-.4 2-1.4 3.2-2.8 3.7.4-3.4-1-6.4-3.6-8.7.2 3.6-1.6 5.6-3 7.5A8 8 0 0 0 5 15.2C5 19.3 8 22 12 22z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  badge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

// ---------- Small building blocks ----------
function moneyField(id, label, value, { hint = '', required = false, placeholder = '0.00', attrs = '' } = {}) {
  return `<div class="field">
    <label for="${id}">${esc(label)}${required ? '' : ' <span class="opt">optional</span>'}</label>
    <div class="money-input"><span aria-hidden="true">$</span><input id="${id}" name="${id}" type="text" inputmode="decimal" autocomplete="off" placeholder="${placeholder}" value="${esc(val(value))}" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}-hint"` : ''} ${attrs}></div>
    ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
  </div>`;
}
const HL_ICON = { extra: 'up', surplus: 'up', spending: 'check', debt: 'shield', worth: 'star', logging: 'flame' };
const HL_LABEL = { extra: 'Extra income', surplus: 'Surplus', spending: 'Spending', debt: 'Debt', worth: 'Net worth', logging: 'Consistency' };
function hlItem(h) {
  return `<li class="hl hl-${h.kind}"><span class="hl-icon">${I[HL_ICON[h.kind]] || I.star}</span><div><p class="hl-kind">${HL_LABEL[h.kind] || ''}</p><p class="hl-title">${esc(h.title)}</p><p class="small muted">${esc(h.text)}</p></div></li>`;
}
const toneLabel = { good: 'Going well', tip: 'Idea', 'heads-up': 'Heads-up' };
function chip(tone) { return `<span class="chip chip-${tone}">${toneLabel[tone]}</span>`; }

function lineChart(raw, { title, id }) {
  // One point per day (the latest wins), in date order.
  const byDay = new Map();
  for (const p of [...raw].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))) byDay.set(p.d, p);
  const points = [...byDay.values()];
  if (points.length < 2) return `<div class="chart-empty">Your ${esc(title.toLowerCase())} chart appears after two entries.</div>`;
  const W = 520, H = 190, L = 64, R = 14, T = 14, B = 30;
  const xs = points.map((p) => C.parseISO(p.d).getTime());
  const ys = points.map((p) => p.v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= Math.max(1, Math.abs(y0) * 0.1); y1 += Math.max(1, Math.abs(y1) * 0.1); }
  const padY = (y1 - y0) * 0.12; y0 -= padY; y1 += padY;
  const sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((t) => y0 + (y1 - y0) * t);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(p.v).toFixed(1)}`).join('');
  const area = `${path}L${sx(xs[xs.length - 1]).toFixed(1)},${H - B}L${sx(xs[0]).toFixed(1)},${H - B}Z`;
  const last = points[points.length - 1], first = points[0];
  const desc = `${title}: from ${C.money(first.v)} on ${C.dateLabel(first.d, true)} to ${C.money(last.v)} on ${C.dateLabel(last.d, true)}.`;
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-d"><desc id="${id}-d">${esc(desc)}</desc>
    ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}"/><text class="tick" x="${L - 8}" y="${(sy(t) + 4).toFixed(1)}" text-anchor="end">${esc(compact(t))}</text>`).join('')}
    <path class="area" d="${area}"/><path class="line" d="${path}"/>
    <circle class="dot" cx="${sx(xs[xs.length - 1]).toFixed(1)}" cy="${sy(last.v).toFixed(1)}" r="4.5"/>
    <text class="tick" x="${L}" y="${H - 8}">${esc(C.dateLabel(first.d, true))}</text>
    <text class="tick" x="${W - R}" y="${H - 8}" text-anchor="end">${esc(C.dateLabel(last.d, true))}</text>
  </svg></figure>`;
}
function compact(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return `${s}$${Math.round(a)}`;
}

// ---------- Views ----------
function viewHome() {
  const today = C.todayISO();
  const nw = C.netWorthAt(state, today);
  const cs = C.sortedCheckins(state);
  const last = cs[cs.length - 1], prev = cs[cs.length - 2];
  const lastChange = last ? last.savings - (prev ? prev.savings : state.start?.savings ?? last.savings) : null;
  const sinceStart = state.start ? nw - state.start.netWorth : null;
  const bills = C.billsTotal(state);
  const b = C.bufferMonths(state);
  const m = C.nextMilestone(state);
  const st = C.streakInfo(state);
  const lv = C.levelInfo(C.totalXP(state));
  const loan = C.loanInfo(state);
  const tips = C.insights(state);
  const wins = C.highlights(state);
  const sur = C.monthlySurpluses(state);
  const curSur = sur.find((x) => x.month === C.monthKey(today));
  const lastSur = [...sur].reverse().find((x) => x.complete);
  const wk = C.weekKey(today);
  const userTasks = state.tasks.filter((t) => t.repeat === 'weekly' || !t.done || (t.doneAt && C.weekKey(t.doneAt) === wk));
  const autos = C.autoTasks(state);

  const banners = [];
  if (isIOS && !isStandalone() && !state.settings.iosPromptSeen) {
    banners.push(`<section class="card notice" aria-labelledby="ios-h"><h2 id="ios-h">Add Month Ahead to your Home Screen</h2>
      <p>iPhone can clear saved website data after a few weeks of not visiting. Installing keeps your numbers safer.</p>
      <ol class="steps"><li>Tap the <strong>Share</strong> button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Open Month Ahead from the new icon.</li></ol>
      <button class="btn ghost" data-action="ios-seen">Got it</button></section>`);
  } else if (ui.installEvt && !isStandalone()) {
    banners.push(`<section class="card notice"><h2>Install Month Ahead</h2><p>Put it on your home screen so it opens like an app and works offline.</p><button class="btn primary" data-action="install">Install app</button></section>`);
  }
  if (C.backupDue(state)) {
    const lastB = state.settings.lastBackupAt;
    banners.push(`<section class="card notice soft"><p><strong>Time for a backup.</strong> ${lastB ? `Your last one was ${C.daysBetween(lastB.slice(0, 10), today)} days ago.` : 'You have not saved one yet.'} Your data only lives on this phone, so a backup file is your safety net.</p>
      <a class="btn ghost" href="#data">Back up now</a></section>`);
  }

  let gauge;
  if (b == null) {
    gauge = `<p class="muted">Add your monthly bills to see how many months you have covered.</p><a class="btn ghost" href="#bills">Add bills</a>`;
  } else {
    const pct = Math.min(b / 3, 1) * 100;
    const stage = b < 1 ? 'Goal: 1 month of bills saved' : b < 3 ? 'First goal reached. Next: 3 months' : '3 months saved. That is a real cushion.';
    gauge = `<p class="gauge-value"><strong>${b.toFixed(1)}</strong> ${b >= 0.95 && b < 1.05 ? 'month' : 'months'} of bills saved</p>
      <div class="gauge" role="meter" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${Math.min(b, 3).toFixed(2)}" aria-valuetext="${b.toFixed(1)} months of bills saved">
        <div class="gauge-fill" style="width:${pct.toFixed(1)}%"></div>
        <span class="gauge-mark" style="left:33.333%"></span>
      </div>
      <div class="gauge-scale" aria-hidden="true"><span>0</span><span class="m1">1 month</span><span>3 months</span></div>
      <p class="muted small">${stage}. Bills are ${C.moneyShort(bills)} a month, so 1 month is ${C.moneyShort(bills)} and 3 months is ${C.moneyShort(bills * 3)}.</p>
      ${m ? `<div class="milestone"><p><strong>Next milestone:</strong> ${m.target} ${m.target === 1 ? 'month' : 'months'} (${C.moneyShort(m.amount)}). ${C.moneyShort(Math.max(0, m.needed))} to go.</p>
        <p class="small muted">${m.projected ? `At ${m.pace.source === 'recent' ? 'your recent pace' : 'your plan’s pace'} of ${C.moneyShort(m.pace.perWeek)} a week, you could get there around <strong>${C.dateLabel(m.projected, true)}</strong>. This is an estimate, not a promise.` : 'No projected date yet. Once savings trend upward for a couple of weeks, an estimate appears here.'}</p></div>` : ''}`;
  }

  return `
  <header class="top"><div><p class="eyebrow">${esc(C.parseISO(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))}</p><h1>Month Ahead</h1></div>
    <a class="icon-btn" href="#data" aria-label="Your data and backups">${I.gear}</a></header>
  ${banners.join('')}
  <section class="hero" aria-labelledby="nw-h">
    <h2 id="nw-h" class="label">Total net worth</h2>
    <p class="headline">${C.money(nw, { cents: false })}</p>
    <div class="deltas">
      <p><span class="label">Last week (savings)</span> <span class="num ${lastChange > 0 ? 'pos' : ''}">${lastChange == null ? 'No check-in yet' : C.signed(lastChange)}</span></p>
      <p><span class="label">Since you started</span> <span class="num ${sinceStart > 0 ? 'pos' : ''}">${sinceStart == null ? '—' : C.signed(sinceStart)}</span></p>
    </div>
  </section>
  <section class="card" aria-labelledby="wins-h"><h2 id="wins-h">Wins to notice</h2>
    <div class="flow">
      <p><span class="label">Cash this month</span> <span class="num ${curSur?.change > 0 ? 'pos' : ''}">${curSur ? C.signed(curSur.change) + ' so far' : 'Check in to see'}</span></p>
      <p><span class="label">${lastSur ? C.monthLabel(lastSur.month, true).split(' ')[0] : 'Last month'}</span> <span class="num ${lastSur?.change > 0 ? 'pos' : ''}">${lastSur ? (lastSur.change > 0 ? 'Surplus ' : lastSur.change < 0 ? 'Short ' : 'Even ') + C.moneyShort(Math.abs(lastSur.change)) : 'Not finished yet'}</span></p>
    </div>
    ${wins.length ? `<ul class="hl-list">${wins.slice(0, 4).map(hlItem).join('')}</ul>` : '<p class="muted">Your wins show up here as you check in: surplus months, weeks under your spending plan, debt paid down, extra income banked and streaks.</p>'}
  </section>
  <section class="card" aria-labelledby="buf-h"><h2 id="buf-h">Savings buffer</h2>${gauge}</section>
  <section class="stats" aria-label="Streak and level">
    <div class="card stat"><span class="stat-icon">${I.flame}</span><p class="stat-num">${st.streak} <span>${st.streak === 1 ? 'week' : 'weeks'}</span></p><p class="label">Check-in streak</p>
      <p class="small muted">${I.shield.replace('<svg', '<svg class="inline"')} ${st.shields} ${st.shields === 1 ? 'shield' : 'shields'}. A shield covers one missed week.</p>
      ${st.atRisk ? '<p class="small warn">Your shield covered last week. Check in this week to keep the streak going.</p>' : ''}</div>
    <div class="card stat"><span class="stat-icon">${I.star}</span><p class="stat-num">Level ${lv.level}</p><p class="label">${lv.xp} XP</p>
      <div class="bar" role="progressbar" aria-label="Progress to level ${lv.level + 1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(lv.progress * 100)}"><div style="width:${(lv.progress * 100).toFixed(0)}%"></div></div>
      <p class="small muted">${lv.toNext} XP to level ${lv.level + 1}</p></div>
  </section>
  <section class="card" aria-labelledby="tasks-h"><h2 id="tasks-h">This week</h2>
    <ul class="tasks">
      ${autos.map((t) => `<li><a class="task-link" href="${t.href}"><span class="box" aria-hidden="true"></span><span>${esc(t.text)}</span>${I.arrow}</a></li>`).join('')}
      ${userTasks.map((t) => { const done = t.repeat === 'weekly' ? (t.doneWeeks || []).includes(wk) : t.done; return `<li><label class="task"><input type="checkbox" data-task="${t.id}" ${done ? 'checked' : ''}><span>${esc(t.text)}${t.repeat === 'weekly' ? ' <span class="opt">weekly</span>' : ''}</span></label></li>`; }).join('')}
      ${!autos.length && !userTasks.length ? '<li class="muted">All clear. Add your own tasks on the Growth tab.</li>' : ''}
    </ul></section>
  ${tips.length ? `<section class="card" aria-labelledby="tips-h"><h2 id="tips-h">What your numbers say</h2><ul class="tips">${tips.map((t) => `<li>${chip(t.tone)}<p>${esc(t.text)}</p></li>`).join('')}</ul>
    <p class="small muted">Worked out on this phone from your entries. Simple rules, not financial advice.</p></section>` : ''}
  ${loan ? loanCard(loan) : ''}
  <section class="card" aria-labelledby="sum-h"><h2 id="sum-h">Want a second opinion?</h2>
    <p class="muted">Copy a plain-text summary of your numbers, then paste it into a chat with Claude for personal feedback. Nothing is sent unless you paste it yourself.</p>
    <button class="btn primary wide" data-action="copy-summary">${I.copy} Copy summary for Claude</button></section>`;
}

function loanCard(loan) {
  const pct = loan.total ? Math.min(1, loan.made / loan.total) : 0;
  return `<section class="card" aria-labelledby="loan-h"><h2 id="loan-h">Loan forgiveness count</h2>
    <p class="stat-num">${loan.remaining} <span>payments left</span></p>
    <div class="bar" role="progressbar" aria-label="Payments logged" aria-valuemin="0" aria-valuemax="${loan.total}" aria-valuenow="${loan.made}"><div style="width:${(pct * 100).toFixed(1)}%"></div></div>
    <p class="small muted">${loan.made} logged here. Projected finish: <strong>${C.monthLabel(loan.finish, true)}</strong>.</p>
    <div class="row">
      <button class="btn primary" data-action="loan-log" ${loan.loggedThisMonth || loan.remaining === 0 ? 'disabled' : ''}>${loan.loggedThisMonth ? 'This month is logged' : 'Log this month’s payment'}</button>
      ${loan.made ? '<button class="btn ghost" data-action="loan-undo">Undo last</button>' : ''}
    </div>
    <p class="small muted">This is your own tally. The official count lives at <a href="https://studentaid.gov" target="_blank" rel="noopener noreferrer">StudentAid.gov</a>.</p></section>`;
}

function viewCheckin(sub) {
  if (ui.reward) return viewReward();
  const monthly = sub === 'monthly';
  return `<header class="top"><h1>Check-in</h1></header>
    <div class="segmented" role="tablist" aria-label="Check-in type">
      <a role="tab" href="#checkin" aria-selected="${!monthly}" class="${!monthly ? 'on' : ''}">Weekly</a>
      <a role="tab" href="#checkin/monthly" aria-selected="${monthly}" class="${monthly ? 'on' : ''}">Monthly</a>
    </div>
    ${monthly ? monthlyForm() : weeklyForm(sub)}`;
}

function weeklyForm(sub) {
  const today = C.todayISO();
  const date = sub && /^\d{4}-\d{2}-\d{2}$/.test(sub) ? sub : today;
  const existing = state.checkins.find((c) => c.week === C.weekKey(date));
  const c = existing || {};
  return `<form class="card form" data-form="weekly" novalidate>
    <p class="muted">About a minute. Only savings is required.</p>
    <p class="note" id="week-note" ${existing ? '' : 'hidden'}>You already checked in for the week of ${C.dateLabel(C.weekKey(date))}. Saving again updates it.</p>
    <div class="field"><label for="ci-date">Date</label><input id="ci-date" name="date" type="date" value="${existing ? existing.date : date}" max="${today}" required></div>
    ${moneyField('ci-savings', 'Savings balance', c.savings, { required: true, hint: 'Zero is fine. Honest numbers make the trend useful.' })}
    ${moneyField('ci-checking', 'Checking balance', c.checking)}
    ${moneyField('ci-spent', 'Spending money used this week', c.spent, { hint: state.plan.weeklySpending ? `Your plan is ${C.money(state.plan.weeklySpending)} a week. Coming in under earns bonus XP.` : '' })}
    ${moneyField('ci-extra', 'Extra income this week', c.extraIncome, { hint: 'Money beyond regular paychecks, like a UC class payment, bonus or refund. Moving at least half of it to savings earns a badge.' })}
    <fieldset class="field"><legend>Any new debt this week?</legend>
      <div class="choice"><label><input type="radio" name="newDebt" value="no" ${c.newDebt === false ? 'checked' : ''} required> No</label>
      <label><input type="radio" name="newDebt" value="yes" ${c.newDebt === true ? 'checked' : ''}> Yes</label></div>
      <p class="hint">New credit card charges you can’t pay off, a loan, or borrowing from someone.</p></fieldset>
    <div class="field"><label for="ci-win">One win this week <span class="opt">optional</span></label>
      <input id="ci-win" name="win" type="text" maxlength="140" value="${esc(c.win || '')}" placeholder="Packed lunch four days" aria-describedby="win-count">
      <p class="hint" id="win-count">${(c.win || '').length}/140</p></div>
    <p class="form-error" role="alert" id="ci-error"></p>
    <button class="btn primary wide big" type="submit">${existing ? 'Update check-in' : 'Save check-in'}</button>
  </form>`;
}

function viewReward() {
  const r = ui.reward;
  return `<section class="reward" aria-labelledby="rw-h">
    <p class="eyebrow">${r.updated ? 'Check-in updated' : 'Check-in saved'}</p>
    <h1 id="rw-h" tabindex="-1">${r.savingsChange > 0 ? 'Savings up ' + C.moneyShort(r.savingsChange) : r.highlights.length ? esc(r.highlights[0].title) : r.savingsChange < 0 ? 'Savings down ' + C.moneyShort(-r.savingsChange) + ' this week' : r.isFirst ? 'You’re on the board' : 'Savings held steady'}</h1>
    <p class="reward-line">${esc(r.line)}</p>
    <dl class="reward-grid">
      ${r.months != null ? `<div><dt>Months of bills saved</dt><dd>${r.months.toFixed(1)}</dd></div>` : ''}
      <div><dt>Change since you started</dt><dd>${r.sinceStart == null ? '—' : C.signed(r.sinceStart)}</dd></div>
      <div><dt>XP earned</dt><dd>+${r.xp}</dd></div>
      <div><dt>Streak</dt><dd>${r.streak} ${r.streak === 1 ? 'week' : 'weeks'}</dd></div>
    </dl>
    ${r.highlights.length ? `<div class="highlights"><h2>Wins this week</h2><ul class="hl-list">${r.highlights.map(hlItem).join('')}</ul></div>` : ''}
    <details class="xp-detail"><summary>How you earned ${r.xp} XP</summary><ul>${r.xpParts.map(([k, v]) => `<li><span>${esc(k)}</span><span class="num">+${v}</span></li>`).join('')}</ul></details>
    ${r.levelUp ? `<p class="levelup">${I.star} Level ${r.level} reached</p>` : ''}
    ${r.badges.length ? `<div class="new-badges"><h2>New badge${r.badges.length > 1 ? 's' : ''}</h2>${r.badges.map((b) => `<div class="badge earned">${I.badge}<div><strong>${esc(b.name)}</strong><p class="small">${esc(b.desc)}</p></div></div>`).join('')}</div>` : ''}
    <div class="stack">
      <a class="btn primary wide big" href="#home" data-action="close-reward">Back to Home</a>
      <button class="btn ghost wide" data-action="copy-summary">${I.copy} Copy summary for Claude</button>
    </div></section>`;
}

function monthlyForm() {
  const today = C.todayISO();
  const ym = ui.monthlyMonth || C.monthKey(today);
  const ms = C.sortedMonthly(state);
  const existing = ms.find((m) => m.month === ym);
  const before = ms.filter((m) => m.month < ym);
  const prefill = existing || before[before.length - 1] || {};
  const res = ui.monthlyResult;
  return `<form class="card form" data-form="monthly" novalidate>
    <p class="muted">Once a month, update your bigger accounts. ${existing ? 'This month is saved. Saving again updates it.' : before.length ? 'Last month’s numbers are filled in. Change what moved.' : 'Leave blank anything you don’t have.'}</p>
    <div class="field"><label for="mo-month">Month</label><input id="mo-month" name="month" type="month" value="${ym}" max="${C.monthKey(today)}" required></div>
    <h2 class="sub">What you own</h2>
    ${C.ACCOUNT_FIELDS.filter((f) => f.kind === 'asset').map((f) => moneyField(`mo-${f.key}`, f.label, prefill[f.key])).join('')}
    <h2 class="sub">What you owe</h2>
    ${C.ACCOUNT_FIELDS.filter((f) => f.kind === 'debt').map((f) => moneyField(`mo-${f.key}`, f.label, prefill[f.key])).join('')}
    <div class="preview" aria-live="polite" id="mo-preview"></div>
    <p class="form-error" role="alert" id="mo-error"></p>
    <button class="btn primary wide big" type="submit">${existing ? 'Update monthly' : 'Save monthly update'}</button>
    ${res ? `<p class="note good" role="status">Saved. Total worth ${C.money(res.worth, { cents: false })}${res.change != null ? ` (${C.signed(res.change)} vs last update)` : ''}.</p>` : ''}
  </form>`;
}

function monthlyPreview() {
  const box = $('#mo-preview'); if (!box) return;
  const vals = readMonthlyInputs();
  const { savings, checking } = C.cashAt(state, C.todayISO());
  let worth = (savings || 0) + (checking || 0);
  for (const f of C.ACCOUNT_FIELDS) worth += (f.kind === 'asset' ? 1 : -1) * (vals[f.key] || 0);
  const ms = C.sortedMonthly(state).filter((m) => m.month < vals.month);
  const prev = ms[ms.length - 1];
  const prevWorth = prev ? C.monthlyWorth(state, prev) : null;
  box.innerHTML = `<p><span class="label">Total worth</span> <strong class="num">${C.money(worth, { cents: false })}</strong></p>
    <p class="small muted">Includes savings ${C.moneyShort(savings)} and checking ${C.moneyShort(checking)} from your latest check-in.${prevWorth != null ? ` Change vs last update: <strong>${C.signed(worth - prevWorth)}</strong>.` : ''}</p>`;
}
function readMonthlyInputs() {
  const out = { month: $('#mo-month')?.value };
  for (const f of C.ACCOUNT_FIELDS) out[f.key] = C.parseMoney($(`#mo-${f.key}`)?.value);
  return out;
}

function freqOptions(sel) { return Object.entries(C.FREQS).map(([k, f]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${f.label}</option>`).join(''); }
const CATEGORIES = ['Housing', 'Utilities', 'Phone & internet', 'Transportation', 'Insurance', 'Debt payments', 'Childcare', 'Subscriptions', 'Health', 'Other'];

function viewBills() {
  const ym = C.monthKey(C.todayISO());
  const total = C.billsTotal(state, ym);
  const next = C.billsTotal(state, C.addMonths(ym, 1));
  const ending = C.billsEndingAfter(state, ym);
  const active = state.bills.filter((b) => C.billApplies(b, ym));
  const ended = state.bills.filter((b) => !C.billApplies(b, ym));
  const groups = {};
  for (const b of active) (groups[b.category || 'Other'] ||= []).push(b);
  const plan = C.planMonthly(state);

  const billRow = (b, isEnded) => `<li class="bill ${isEnded ? 'ended' : ''}">
    <div class="bill-main"><label class="sr" for="bn-${b.id}">Bill name</label><input id="bn-${b.id}" class="bill-name" data-bill="${b.id}" data-field="name" value="${esc(b.name)}">
      <div class="money-input small"><span aria-hidden="true">$</span><label class="sr" for="ba-${b.id}">Amount for ${esc(b.name)}</label><input id="ba-${b.id}" data-bill="${b.id}" data-field="amount" inputmode="decimal" value="${esc(val(b.amount))}"></div></div>
    <div class="bill-meta"><label for="be-${b.id}">Last month it applies</label><input id="be-${b.id}" type="month" data-bill="${b.id}" data-field="endMonth" value="${esc(b.endMonth || '')}">
      <button class="btn text danger" data-action="del-bill" data-id="${b.id}" aria-label="Delete ${esc(b.name)}">Delete</button></div>
    ${isEnded ? `<p class="small muted">Ended after ${C.monthLabel(b.endMonth)}. Not counted.</p>` : b.endMonth ? `<p class="small muted">Counts through ${C.monthLabel(b.endMonth, true)}.</p>` : ''}
  </li>`;

  return `<header class="top"><h1>Bills & plan</h1></header>
  <section class="hero small-hero" aria-labelledby="bt-h"><h2 id="bt-h" class="label">Monthly bills (${C.monthLabel(ym, true)})</h2><p class="headline">${C.money(total)}</p>
    <p class="muted small">Your savings goal follows this: 1 month = ${C.moneyShort(total)}, 3 months = ${C.moneyShort(total * 3)}.</p></section>
  ${next < total ? `<section class="card notice good"><p><strong>Bills drop next month.</strong> In ${C.monthLabel(C.addMonths(ym, 1), true)} they fall to ${C.money(next)}, saving ${C.money(total - next)} a month${ending.length ? ` as ${esc(ending.map((b) => b.name).join(', '))} ${ending.length > 1 ? 'end' : 'ends'}` : ''}. Consider sending that amount to savings.</p></section>` : ''}
  ${Object.keys(groups).sort().map((g) => `<section class="card" aria-labelledby="g-${esc(g).replace(/\W/g, '')}"><div class="group-h"><h2 id="g-${esc(g).replace(/\W/g, '')}">${esc(g)}</h2><span class="num">${C.money(groups[g].reduce((s, b) => s + (b.amount || 0), 0))}</span></div>
    <ul class="bills">${groups[g].map((b) => billRow(b, false)).join('')}</ul></section>`).join('')}
  ${!active.length ? '<section class="card"><p class="muted">No bills yet. Add rent or mortgage, utilities, phone, insurance, car payments and anything else that is due every month.</p></section>' : ''}
  <form class="card form" data-form="add-bill"><h2>Add a bill</h2>
    <div class="field"><label for="nb-name">Name</label><input id="nb-name" required placeholder="Electric" autocomplete="off"></div>
    ${moneyField('nb-amount', 'Monthly amount', null, { required: true })}
    <div class="field"><label for="nb-cat">Category</label><input id="nb-cat" list="cat-list" placeholder="Utilities" autocomplete="off"><datalist id="cat-list">${CATEGORIES.map((c) => `<option value="${c}">`).join('')}</datalist></div>
    <div class="field"><label for="nb-end">Last month it applies <span class="opt">optional</span></label><input id="nb-end" type="month" aria-describedby="nb-end-h"><p class="hint" id="nb-end-h">For a bill that will be paid off, like a car loan. Your total drops automatically after this month.</p></div>
    <p class="form-error" role="alert" id="nb-error"></p>
    <button class="btn primary wide" type="submit">Add bill</button></form>
  ${ended.length ? `<section class="card"><h2>Ended bills</h2><ul class="bills">${ended.map((b) => billRow(b, true)).join('')}</ul></section>` : ''}

  <section class="card" aria-labelledby="ct-h"><div class="group-h"><h2 id="ct-h">Savings contributions</h2><span class="num">${C.money(C.contributionsTotal(state))}</span></div>
    <p class="small muted">Money you put away each month, like a college savings account. Not counted as bills.</p>
    <ul class="bills">${state.contributions.map((c) => `<li class="bill"><div class="bill-main"><label class="sr" for="cn-${c.id}">Name</label><input id="cn-${c.id}" class="bill-name" data-contrib="${c.id}" data-field="name" value="${esc(c.name)}">
      <div class="money-input small"><span aria-hidden="true">$</span><label class="sr" for="ca-${c.id}">Amount for ${esc(c.name)}</label><input id="ca-${c.id}" data-contrib="${c.id}" data-field="amount" inputmode="decimal" value="${esc(val(c.amount))}"></div></div>
      <div class="bill-meta"><span></span><button class="btn text danger" data-action="del-contrib" data-id="${c.id}" aria-label="Delete ${esc(c.name)}">Delete</button></div></li>`).join('')}</ul>
    <form class="inline-add" data-form="add-contrib"><label class="sr" for="nc-name">Contribution name</label><input id="nc-name" placeholder="College savings" required autocomplete="off">
      <div class="money-input small"><span aria-hidden="true">$</span><label class="sr" for="nc-amount">Monthly amount</label><input id="nc-amount" inputmode="decimal" placeholder="0" required></div>
      <button class="btn ghost" type="submit">Add</button></form></section>

  <section class="card" aria-labelledby="inc-h"><div class="group-h"><h2 id="inc-h">Household income</h2><span class="num">${plan.income == null ? '' : C.money(plan.income) + '/mo'}</span></div>
    <p class="small muted">Take-home pay for everyone in the household. Each source can have its own schedule. Monthly figures are averages: every two weeks = 26 a year ÷ 12.</p>
    <ul class="bills">${(state.incomes || []).map((x) => `<li class="bill income">
      <div class="bill-main"><label class="sr" for="in-${x.id}">Income name</label><input id="in-${x.id}" class="bill-name" data-income="${x.id}" data-field="name" value="${esc(x.name)}">
        <div class="money-input small"><span aria-hidden="true">$</span><label class="sr" for="ia-${x.id}">Amount per payment for ${esc(x.name)}</label><input id="ia-${x.id}" data-income="${x.id}" data-field="amount" inputmode="decimal" value="${esc(val(x.amount))}"></div></div>
      <div class="bill-meta"><label class="sr" for="if-${x.id}">How often</label><select id="if-${x.id}" data-income="${x.id}" data-field="freq">${freqOptions(x.freq)}</select>
        ${x.freq === 'perYear' ? `<label for="ic-${x.id}">Times a year</label><input id="ic-${x.id}" class="count" data-income="${x.id}" data-field="count" inputmode="decimal" value="${esc(val(x.count))}">` : ''}
        <button class="btn text danger" data-action="del-income" data-id="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button></div>
      <label class="switch small"><input type="checkbox" data-income="${x.id}" data-field="reliable" ${x.reliable !== false ? 'checked' : ''}> Steady income I can count on every month</label>
      <p class="small muted">About ${C.money(C.incomeMonthly(x))} a month on average.</p>
    </li>`).join('')}</ul>
    ${!(state.incomes || []).length ? '<p class="muted">No income added yet.</p>' : ''}
    <form class="form sub-form" data-form="add-income"><h3>Add income</h3>
      <div class="chips" aria-label="Common income types">
        <button type="button" class="chip-btn" data-action="inc-preset" data-name="My pay" data-freq="biweekly">My pay (every 2 weeks)</button>
        <button type="button" class="chip-btn" data-action="inc-preset" data-name="Spouse’s pay" data-freq="monthly">Spouse’s pay (monthly)</button>
        <button type="button" class="chip-btn" data-action="inc-preset" data-name="Teaching (per class)" data-freq="perYear">Per class or gig</button>
      </div>
      <div class="field"><label for="ni-name">Name</label><input id="ni-name" placeholder="Spouse’s pay" autocomplete="off"></div>
      ${moneyField('ni-amount', 'Take-home per payment', null, { required: true })}
      <div class="field"><label for="ni-freq">How often</label><select id="ni-freq">${freqOptions('biweekly')}</select></div>
      <div class="field" id="ni-count-wrap" hidden><label for="ni-count">About how many times a year?</label><input id="ni-count" inputmode="decimal" placeholder="4" aria-describedby="ni-count-h"><p class="hint" id="ni-count-h">If it varies, use the low end. Anything extra becomes a pleasant surprise.</p></div>
      <p class="form-error" role="alert" id="ni-error"></p>
      <button class="btn primary wide" type="submit">Add income</button></form>
  </section>

  <section class="card form" aria-labelledby="pp-h"><h2 id="pp-h">Monthly plan</h2>
    ${moneyField('pp-savingsMonthly', 'Send to savings each month', state.plan.savingsMonthly, { attrs: 'data-plan="savingsMonthly"' })}
    ${moneyField('pp-weeklySpending', 'Household spending money per week', state.plan.weeklySpending, { attrs: 'data-plan="weeklySpending"', hint: 'Groceries, gas, eating out, fun. Everything that isn’t a bill.' })}
    <dl class="plan-table">
      <div><dt>Income per month (average)</dt><dd>${C.money(plan.income)}</dd></div>
      ${plan.irregular ? `<div class="indent"><dt>Steady</dt><dd>${C.money(plan.reliable)}</dd></div><div class="indent"><dt>Irregular, averaged</dt><dd>${C.money(plan.irregular)}</dd></div>` : ''}
      <div><dt>Bills</dt><dd>−${C.money(plan.bills)}</dd></div>
      <div><dt>Savings contributions</dt><dd>−${C.money(plan.contrib)}</dd></div>
      <div><dt>To savings</dt><dd>−${C.money(plan.toSavings ?? 0)}</dd></div>
      <div><dt>Spending money</dt><dd>−${C.money(plan.spending ?? 0)}</dd></div>
      <div class="total"><dt>Planned surplus</dt><dd class="${plan.leftover < 0 ? 'neg' : ''}">${plan.leftover == null ? 'Add income' : C.signed(plan.leftover, false)}</dd></div>
      ${plan.irregular ? `<div><dt>On steady income only</dt><dd class="${plan.leftoverReliable < 0 ? 'neg' : ''}">${C.signed(plan.leftoverReliable, false)}</dd></div>` : ''}
    </dl>
    ${plan.leftover != null && plan.leftover < 0 ? '<p class="small warn">The plan spends more than comes in. Lower spending money or the savings amount until this is zero or more.</p>' : plan.leftover > 0 ? `<p class="small muted">A planned surplus of ${C.moneyShort(plan.leftover)} a month. Each month you actually finish ahead earns a Surplus month on your Growth tab.</p>` : ''}
  </section>`;
}

function viewGrowth() {
  const cs = C.sortedCheckins(state);
  const ms = C.sortedMonthly(state);
  const dates = new Set();
  if (state.start) dates.add(state.start.date);
  cs.forEach((c) => dates.add(c.date));
  ms.forEach((m) => dates.add(m.date));
  const nwPts = [...dates].sort().map((d) => ({ d, v: C.netWorthAt(state, d) }));
  const retPts = ms.filter((m) => m.retirement1 != null || m.retirement2 != null).map((m) => ({ d: m.date, v: (m.retirement1 || 0) + (m.retirement2 || 0) }));
  const savPts = [...(state.start ? [{ d: state.start.date, v: state.start.savings || 0 }] : []), ...cs.map((c) => ({ d: c.date, v: c.savings }))];
  const earned = state.badges;
  const debtsOf = C.debtsOf;
  const sur = C.monthlySurpluses(state).slice(-12);
  const maxAbs = Math.max(1, ...sur.map((m) => Math.abs(m.change)));
  const spendPts = C.spendingWeeks(state).map((w) => ({ d: w.date, v: w.spent }));
  const sw = C.spendingWeeks(state);
  const under = sw.filter((w) => w.under).length;

  return `<header class="top"><h1>Growth</h1></header>
  <section class="card" aria-labelledby="ch1"><h2 id="ch1">Total net worth</h2>${lineChart(nwPts, { title: 'Total net worth', id: 'c1' })}</section>
  <section class="card" aria-labelledby="ch3"><h2 id="ch3">Savings</h2>${lineChart(savPts, { title: 'Savings', id: 'c3' })}</section>
  <section class="card" aria-labelledby="sp-h"><h2 id="sp-h">Surplus by month</h2>
    <p class="small muted">Change in savings plus checking from one month’s last check-in to the next. Above zero means you came out ahead.</p>
    ${sur.length ? `<ul class="surplus">${sur.slice().reverse().map((m) => `<li><span class="s-month">${C.monthLabel(m.month)}${m.complete ? '' : ' <span class="opt">so far</span>'}</span>
      <span class="s-bar" aria-hidden="true"><span class="${m.change >= 0 ? 'up' : 'down'}" style="width:${(Math.abs(m.change) / maxAbs * 100).toFixed(1)}%"></span></span>
      <span class="num ${m.change > 0 ? 'pos' : ''}">${m.change > 0 ? 'Surplus ' : m.change < 0 ? 'Short ' : 'Even '}${C.moneyShort(Math.abs(m.change))}</span></li>`).join('')}</ul>` : '<p class="chart-empty">Check in this week to start your first month.</p>'}
  </section>
  <section class="card" aria-labelledby="sw-h"><h2 id="sw-h">Weekly spending</h2>
    ${sw.length && state.plan.weeklySpending != null ? `<p class="small muted">Under your ${C.moneyShort(state.plan.weeklySpending)} plan in ${under} of ${sw.length} weeks logged.</p>` : ''}
    ${lineChart(spendPts, { title: 'Weekly spending', id: 'c4' })}</section>
  <section class="card" aria-labelledby="ch2"><h2 id="ch2">Retirement</h2>${lineChart(retPts, { title: 'Retirement', id: 'c2' })}</section>
  <section class="card" aria-labelledby="mh-h"><h2 id="mh-h">Monthly history</h2>
    ${ms.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Month</th><th scope="col">Total worth</th><th scope="col">Change</th><th scope="col">Retirement</th><th scope="col">Debts</th></tr></thead><tbody>
      ${ms.slice().reverse().map((m, i, arr) => { const w = C.monthlyWorth(state, m); const pm = arr[i + 1]; return `<tr><th scope="row">${C.monthLabel(m.month)}</th><td>${C.moneyShort(w)}</td><td>${pm ? C.signed(w - C.monthlyWorth(state, pm)) : '—'}</td><td>${C.moneyShort((m.retirement1 || 0) + (m.retirement2 || 0))}</td><td>${C.moneyShort(debtsOf(m))}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="muted">Save a monthly update to start your history.</p><a class="btn ghost" href="#checkin/monthly">Monthly update</a>'}
  </section>
  <section class="card" aria-labelledby="wl-h"><h2 id="wl-h">Weekly log</h2>
    ${cs.length ? `<ul class="log">${cs.slice().reverse().map((c, i, arr) => { const p = arr[i + 1]; const ch = p ? c.savings - p.savings : null; return `<li><a href="#checkin/${c.date}" aria-label="Edit check-in for ${C.dateLabel(c.date, true)}">
      <div class="log-top"><strong>${C.dateLabel(c.date, true)}</strong><span class="num">${C.money(c.savings)}${ch != null ? ` <span class="${ch > 0 ? 'pos' : ''}">(${C.signed(ch)})</span>` : ''}</span></div>
      <p class="small muted">${c.spent != null ? `Spent ${C.moneyShort(c.spent)} · ` : ''}${c.extraIncome ? `Extra income ${C.moneyShort(c.extraIncome)} · ` : ''}New debt: ${c.newDebt ? 'yes' : 'no'}${c.win ? ` · Win: ${esc(c.win)}` : ''}</p></a></li>`; }).join('')}</ul>` : '<p class="muted">Your weekly check-ins will show up here.</p>'}
  </section>
  <section class="card" aria-labelledby="bd-h"><h2 id="bd-h">Badges <span class="muted small">${Object.keys(earned).length} of ${C.BADGES.length}</span></h2>
    ${(() => { const card = (b) => `<li class="badge ${earned[b.id] ? 'earned' : 'locked'}">${earned[b.id] ? I.badge : I.lock}<div><strong>${esc(b.name)}</strong><p class="small">${esc(b.desc)}</p><p class="small muted">${earned[b.id] ? `Earned ${C.dateLabel(earned[b.id], true)}` : 'Not yet'}</p></div></li>`;
      const got = C.BADGES.filter((b) => earned[b.id]), todo = C.BADGES.filter((b) => !earned[b.id]);
      return `${got.length ? `<ul class="badges">${got.map(card).join('')}</ul>` : '<p class="muted">Your first badge comes with your first check-in.</p>'}
      ${todo.length ? `<details class="paste"><summary>${todo.length} badges still to earn</summary><ul class="badges">${todo.map(card).join('')}</ul></details>` : ''}`; })()}</section>
  <section class="card" aria-labelledby="tk-h"><h2 id="tk-h">Your tasks</h2>
    <p class="small muted">Weekly tasks reset every Monday. One-time tasks stay done.</p>
    <ul class="task-edit">${state.tasks.map((t) => `<li><label class="sr" for="tt-${t.id}">Task</label><input id="tt-${t.id}" data-taskedit="${t.id}" data-field="text" value="${esc(t.text)}">
      <label class="sr" for="tr-${t.id}">Repeats</label><select id="tr-${t.id}" data-taskedit="${t.id}" data-field="repeat"><option value="weekly" ${t.repeat === 'weekly' ? 'selected' : ''}>Weekly</option><option value="once" ${t.repeat === 'once' ? 'selected' : ''}>Once</option></select>
      <button class="btn text danger" data-action="del-task" data-id="${t.id}" aria-label="Delete task ${esc(t.text)}">Delete</button></li>`).join('')}</ul>
    <form class="inline-add" data-form="add-task"><label class="sr" for="nt-text">New task</label><input id="nt-text" placeholder="Cancel one unused subscription" required autocomplete="off">
      <label class="sr" for="nt-rep">Repeats</label><select id="nt-rep"><option value="once">Once</option><option value="weekly">Weekly</option></select>
      <button class="btn ghost" type="submit">Add</button></form></section>`;
}

function viewData() {
  const last = state.settings.lastBackupAt;
  const loan = state.loan;
  return `<header class="top"><a class="icon-btn back" href="${state.settings.setupDone ? '#home' : '#setup'}" aria-label="Back">${I.arrow}</a><h1>Your data</h1></header>
  <section class="card"><h2>Where your data lives</h2>
    <p>Everything you enter is saved only on this device, in this browser. There is no account, no sync and no server. Month Ahead makes no network requests except loading its own files.</p>
    <p class="small muted">Storage: ${S.storageKind === 'indexeddb' ? 'IndexedDB' : 'localStorage'} · Protected from automatic clearing: ${ui.persisted == null ? 'unknown' : ui.persisted ? 'yes' : 'not yet'}</p>
    ${ui.persisted === false ? '<button class="btn ghost" data-action="persist">Ask to keep my data</button>' : ''}</section>
  <section class="card"><h2>Backups</h2>
    <p class="muted">${last ? `Last backup: ${C.dateLabel(last.slice(0, 10), true)}.` : 'No backup yet.'} Save one weekly. To move to a new phone, download a backup here and restore it there.</p>
    <div class="stack">
      <button class="btn primary wide" data-action="download">Download backup file</button>
      <label class="btn ghost wide file-btn">Restore from file<input type="file" id="restore-file" accept="application/json,.json"></label>
      <button class="btn ghost wide" data-action="copy-backup">Copy backup as text</button>
    </div>
    <details class="paste"><summary>Paste a backup</summary>
      <label for="paste-box" class="sr">Backup text</label><textarea id="paste-box" rows="5" placeholder='Paste backup text that starts with {"app": "month-ahead"'></textarea>
      <button class="btn ghost wide" data-action="paste-restore">Restore from pasted text</button></details>
    <p class="small muted">Restoring replaces everything currently in the app.</p></section>
  <section class="card"><h2>Summary for Claude</h2><p class="muted">A plain-text snapshot of your numbers. Paste it into a Claude chat for feedback and suggestions. You decide what to share.</p>
    <button class="btn ghost wide" data-action="copy-summary">${I.copy} Copy summary</button>
    <details class="paste"><summary>Preview the summary</summary><pre class="summary">${esc(C.summaryText(state))}</pre></details></section>
  <section class="card form"><h2>Loan forgiveness card</h2>
    <label class="switch"><input type="checkbox" id="loan-on" ${loan.enabled ? 'checked' : ''}> Show the loan forgiveness counter on Home</label>
    <div class="field"><label for="loan-rem">Qualifying payments remaining when you started counting</label><input id="loan-rem" type="text" inputmode="numeric" value="${esc(val(loan.startRemaining))}" placeholder="e.g. 48"></div>
    <p class="small muted">Payments you log are subtracted from this number.</p></section>
  ${!isStandalone() ? `<section class="card"><h2>Install on your phone</h2>
    ${ui.installEvt ? '<button class="btn primary wide" data-action="install">Install app</button>' : ''}
    <p><strong>iPhone (Safari):</strong> Share button → Add to Home Screen.</p><p><strong>Android (Chrome):</strong> menu ⋮ → Install app or Add to Home screen.</p></section>` : ''}
  <section class="card"><h2>Check that nothing leaves your phone</h2>
    <ol class="steps">
      <li><strong>Airplane mode test:</strong> open the app once, turn on airplane mode, close it fully, reopen it. Everything still works and saves.</li>
      <li><strong>On a computer:</strong> open the app in Chrome, press F12, open the <em>Network</em> tab, tick <em>Preserve log</em> and reload. Every request goes to this app’s own address, served from the service worker. Then add a check-in: no new requests appear.</li>
      <li>The app also blocks outside connections with a content security policy (<code>connect-src 'self'</code>), so even a mistake in the code could not send data elsewhere.</li>
    </ol></section>
  <section class="card danger-zone"><h2>Delete all my data</h2><p class="muted">Removes every check-in, bill, balance and badge from this device. This cannot be undone.</p>
    <button class="btn danger wide" data-action="delete-all">Delete all my data</button></section>
  <p class="small muted center">Month Ahead ${APP_VERSION} · data version ${S.SCHEMA_VERSION}</p>`;
}

// ---------- Setup ----------
const SETUP_STEPS = ['welcome', 'balances', 'bills', 'income', 'plan', 'accounts'];
function newDraft() {
  return { savings: null, checking: null, bills: [], incomes: [], plan: { savingsMonthly: null, weeklySpending: null }, accounts: {}, loanRemaining: null };
}
function viewSetup() {
  const d = (ui.draft ||= newDraft());
  const step = SETUP_STEPS[ui.setupStep];
  const n = ui.setupStep;
  const prog = n > 0 ? `<p class="eyebrow">Step ${n} of ${SETUP_STEPS.length - 1}</p><div class="bar thin" aria-hidden="true"><div style="width:${(n / (SETUP_STEPS.length - 1)) * 100}%"></div></div>` : '';
  const nav = (next = 'Next', skip = false) => `<p class="form-error" role="alert" id="su-error"></p><div class="row end">${n > 0 ? '<button type="button" class="btn ghost" data-action="su-back">Back</button>' : ''}${skip ? '<button type="button" class="btn text" data-action="su-skip">Skip</button>' : ''}<button type="submit" class="btn primary">${next}</button></div>`;
  let body = '';
  if (step === 'welcome') {
    body = `<div class="welcome"><h1 tabindex="-1">Month Ahead</h1>
      <p class="lead">A weekly money check-in that helps you build a cash cushion, one month of bills at a time.</p>
      <ul class="points"><li>${I.lock}<span><strong>Private by design.</strong> Everything stays on this phone. No bank links, no account, no tracking.</span></li>
      <li>${I.check}<span><strong>One minute a week.</strong> Log your savings, see your progress, keep your streak.</span></li>
      <li>${I.growth}<span><strong>Setup takes about 2 minutes.</strong> Starting balances, bills, household income and a simple plan.</span></li></ul></div>
      <div class="stack"><button type="submit" class="btn primary wide big">Start setup</button><a class="btn ghost wide" href="#data">Restore from a backup instead</a></div>`;
  } else if (step === 'balances') {
    body = `<h1 tabindex="-1">Where you are today</h1><p class="muted">This is your starting line. Every bit of progress is measured from here.</p>
      ${moneyField('su-savings', 'Savings balance', d.savings, { required: true, hint: 'Zero is a perfectly good place to start.' })}
      ${moneyField('su-checking', 'Checking balance', d.checking)}${nav()}`;
  } else if (step === 'bills') {
    const sugg = ['Rent or mortgage', 'Electric', 'Water', 'Phone', 'Internet', 'Car payment', 'Car insurance', 'Health insurance', 'Childcare', 'Streaming'].filter((s) => !d.bills.some((b) => b.name === s));
    body = `<h1 tabindex="-1">Your monthly bills</h1><p class="muted">Things due every month. Your savings goal is based on this total. You can edit everything later.</p>
      ${d.bills.length ? `<ul class="draft-bills">${d.bills.map((b, i) => `<li><span>${esc(b.name)}</span><span class="num">${C.money(b.amount)}</span><button type="button" class="btn text danger" data-action="su-del-bill" data-i="${i}" aria-label="Remove ${esc(b.name)}">Remove</button></li>`).join('')}
        <li class="total"><span>Total</span><span class="num">${C.money(d.bills.reduce((s, b) => s + b.amount, 0))}</span><span></span></li></ul>` : ''}
      <div class="add-bill-row"><div class="field"><label for="su-bname">Bill</label><input id="su-bname" autocomplete="off" placeholder="Electric"></div>
        ${moneyField('su-bamt', 'Per month', null, { required: true })}
        <button type="button" class="btn ghost" data-action="su-add-bill">Add</button></div>
      <div class="chips" aria-label="Common bills">${sugg.map((s) => `<button type="button" class="chip-btn" data-action="su-sugg" data-name="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      ${nav(d.bills.length ? 'Next' : 'Next', true)}`;
  } else if (step === 'income') {
    body = `<h1 tabindex="-1">Household income</h1><p class="muted">Add take-home pay for everyone in the household. Each source can have its own schedule, and irregular income like classes or gigs gets averaged.</p>
      ${d.incomes.length ? `<ul class="draft-bills">${d.incomes.map((x, i) => `<li><span>${esc(x.name)}<br><span class="small muted">${esc(C.incomeDescription(x))}</span></span><span class="num">${C.money(C.incomeMonthly(x))}/mo</span><button type="button" class="btn text danger" data-action="su-del-income" data-i="${i}" aria-label="Remove ${esc(x.name)}">Remove</button></li>`).join('')}
        <li class="total"><span>Average per month</span><span class="num">${C.money(d.incomes.reduce((s2, x) => s2 + C.incomeMonthly(x), 0))}</span><span></span></li></ul>` : ''}
      <div class="chips" aria-label="Common income types">
        <button type="button" class="chip-btn" data-action="su-inc-preset" data-name="My pay" data-freq="biweekly">My pay (every 2 weeks)</button>
        <button type="button" class="chip-btn" data-action="su-inc-preset" data-name="Spouse’s pay" data-freq="monthly">Spouse’s pay (monthly)</button>
        <button type="button" class="chip-btn" data-action="su-inc-preset" data-name="Teaching (per class)" data-freq="perYear">Per class or gig</button>
      </div>
      <div class="field"><label for="su-iname">Name</label><input id="su-iname" autocomplete="off" placeholder="My pay"></div>
      ${moneyField('su-iamt', 'Take-home per payment', null, { required: true })}
      <div class="field"><label for="su-ifreq">How often</label><select id="su-ifreq">${freqOptions('biweekly')}</select></div>
      <div class="field" id="su-icount-wrap" hidden><label for="su-icount">About how many times a year?</label><input id="su-icount" inputmode="decimal" placeholder="4"><p class="hint">If it varies, use the low end.</p></div>
      <button type="button" class="btn ghost wide" data-action="su-add-income">Add this income</button>
      ${nav('Next', true)}`;
  } else if (step === 'plan') {
    const inc = d.incomes.reduce((s2, x) => s2 + C.incomeMonthly(x), 0);
    const bills = d.bills.reduce((s2, b) => s2 + b.amount, 0);
    body = `<h1 tabindex="-1">A simple plan</h1><p class="muted">Two numbers. You can change them any time on the Bills tab.</p>
      ${inc ? `<p class="note">Income averages ${C.money(inc)} a month and bills are ${C.money(bills)}, which leaves ${C.money(inc - bills)} for savings and spending.</p>` : ''}
      ${moneyField('su-savingsMonthly', 'Send to savings each month', d.plan.savingsMonthly, { hint: 'Even $50 builds the habit.' })}
      ${moneyField('su-weeklySpending', 'Household spending money per week', d.plan.weeklySpending, { hint: 'Groceries, gas, eating out, fun. Whatever isn’t a bill.' })}${nav('Next', true)}`;
  } else if (step === 'accounts') {
    body = `<h1 tabindex="-1">The bigger picture</h1><p class="muted">Optional. These make your net worth complete. Skip any you don’t have and fill them in later under Check-in → Monthly.</p>
      <h2 class="sub">What you own</h2>${C.ACCOUNT_FIELDS.filter((f) => f.kind === 'asset').map((f) => moneyField(`su-${f.key}`, f.label, d.accounts[f.key])).join('')}
      <h2 class="sub">What you owe</h2>${C.ACCOUNT_FIELDS.filter((f) => f.kind === 'debt').map((f) => moneyField(`su-${f.key}`, f.label, d.accounts[f.key])).join('')}
      <div class="field"><label for="su-loan">Loan forgiveness: qualifying payments remaining <span class="opt">optional</span></label><input id="su-loan" type="text" inputmode="numeric" value="${esc(val(d.loanRemaining))}" placeholder="e.g. 48" aria-describedby="su-loan-h"><p class="hint" id="su-loan-h">Only if you are working toward a forgiveness program. Adds a counter to Home.</p></div>
      ${nav('Finish setup')}`;
  }
  return `<form class="setup" data-form="setup" novalidate>${prog}${body}</form>`;
}

function readSetupStep() {
  const d = ui.draft;
  const step = SETUP_STEPS[ui.setupStep];
  if (step === 'balances') { d.savings = C.parseMoney($('#su-savings').value); d.checking = C.parseMoney($('#su-checking').value); }
  if (step === 'plan') for (const k of ['savingsMonthly', 'weeklySpending']) d.plan[k] = C.parseMoney($(`#su-${k}`).value);
  if (step === 'accounts') {
    for (const f of C.ACCOUNT_FIELDS) d.accounts[f.key] = C.parseMoney($(`#su-${f.key}`).value);
    const r = parseInt($('#su-loan').value, 10); d.loanRemaining = Number.isFinite(r) && r >= 0 ? r : null;
  }
}

async function finishSetup() {
  const d = ui.draft;
  const today = C.todayISO();
  await commit((s) => {
    s.incomes = d.incomes.map((x) => ({ id: S.uid(), ...x }));
    s.plan = { ...d.plan };
    s.bills = d.bills.map((b) => ({ id: S.uid(), name: b.name, category: guessCategory(b.name), amount: b.amount, endMonth: null }));
    const hasAccounts = C.ACCOUNT_FIELDS.some((f) => d.accounts[f.key] != null);
    if (hasAccounts) s.monthly = [{ month: C.monthKey(today), date: today, ...Object.fromEntries(C.ACCOUNT_FIELDS.map((f) => [f.key, d.accounts[f.key] ?? null])) }];
    s.start = { date: today, savings: d.savings ?? 0, checking: d.checking ?? 0, netWorth: 0 };
    s.start.netWorth = C.netWorthAt(s, today);
    if (d.loanRemaining != null) s.loan = { enabled: true, startRemaining: d.loanRemaining, log: [] };
    s.tasks = [
      { id: S.uid(), text: 'Move my savings amount on payday', repeat: 'weekly', doneWeeks: [] },
      { id: S.uid(), text: 'Look over one bill I might be able to lower', repeat: 'once', done: false },
    ];
    s.settings.setupDone = true;
    C.awardBadges(s);
  });
  ui.draft = null; ui.setupStep = 0;
  ui.persisted = await S.requestPersist();
  location.hash = '#home';
  toast('Setup done. Your first check-in is on the Check-in tab.');
}
function guessCategory(name) {
  const n = name.toLowerCase();
  if (/rent|mortgage|hoa/.test(n)) return 'Housing';
  if (/electric|water|gas bill|power|trash|sewer|utility/.test(n)) return 'Utilities';
  if (/phone|internet|wifi|cable/.test(n)) return 'Phone & internet';
  if (/insur/.test(n)) return 'Insurance';
  if (/car|auto|transit|parking/.test(n)) return 'Transportation';
  if (/child|daycare/.test(n)) return 'Childcare';
  if (/stream|netflix|spotify|hulu|subscription|gym/.test(n)) return 'Subscriptions';
  if (/loan|card|debt/.test(n)) return 'Debt payments';
  return 'Other';
}

// ---------- Router & render ----------
function parseRoute() {
  const h = location.hash.replace(/^#/, '') || 'home';
  const [name, sub] = h.split('/');
  return { name, sub };
}
let lastRoute = '';
function render() {
  let { name, sub } = parseRoute();
  if (!state.settings.setupDone && name !== 'setup' && name !== 'data') { location.replace('#setup'); return; }
  if (state.settings.setupDone && name === 'setup') { location.replace('#home'); return; }
  const views = { home: viewHome, checkin: () => viewCheckin(sub), bills: viewBills, growth: viewGrowth, data: viewData, setup: viewSetup };
  if (!views[name]) { location.replace('#home'); return; }
  const routeKey = `${name}/${sub || ''}`;
  const changed = routeKey !== lastRoute;
  const active = document.activeElement?.id;
  const main = $('#view');
  main.innerHTML = (ui.updateReady ? `<div class="update-bar" role="status"><span>A new version of Month Ahead is ready.</span><button class="btn small-btn" data-action="apply-update">Update now</button></div>` : '') + views[name]();
  document.body.dataset.view = name;
  $$('.tabs a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === name ? 'page' : 'false'));
  $('.tabs').hidden = name === 'setup';
  if (changed) {
    lastRoute = routeKey;
    window.scrollTo(0, 0);
    const h = $('h1[tabindex]', main); if (h) h.focus({ preventScroll: true });
  } else if (active && document.getElementById(active)) {
    document.getElementById(active).focus({ preventScroll: true });
  }
  if (name === 'checkin' && sub === 'monthly') monthlyPreview();
}

// ---------- Events ----------
function bindGlobal() {
  const main = $('#view');
  main.addEventListener('click', onClick);
  main.addEventListener('submit', onSubmit);
  main.addEventListener('change', onChange);
  main.addEventListener('input', onInput);
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#checkin')) ui.reward = null; if (location.hash !== '#checkin/monthly') { ui.monthlyResult = null; } render(); });
}

const armed = new WeakMap();
function twoTap(btn, label = 'Tap again to delete') {
  if (armed.get(btn)) return true;
  const orig = btn.textContent;
  armed.set(btn, true); btn.textContent = label; btn.classList.add('armed');
  setTimeout(() => { if (btn.isConnected) { armed.delete(btn); btn.textContent = orig; btn.classList.remove('armed'); } }, 3500);
  return false;
}

async function onClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'copy-summary') { e.preventDefault(); return copyText(C.summaryText(state), 'Summary copied. Paste it into a chat with Claude.'); }
  if (a === 'close-reward') { ui.reward = null; return; }
  if (a === 'ios-seen') { await commit((s) => { s.settings.iosPromptSeen = true; }); return render(); }
  if (a === 'install' && ui.installEvt) { ui.installEvt.prompt(); try { await ui.installEvt.userChoice; } catch { /* ignore */ } ui.installEvt = null; return render(); }
  if (a === 'apply-update') { ui.applyingUpdate = true; ui.swReg?.waiting?.postMessage('SKIP_WAITING'); return; }
  if (a === 'persist') { ui.persisted = await S.requestPersist(); toast(ui.persisted ? 'Your browser will keep this data.' : 'Your browser did not agree yet. Installing the app usually helps.'); return render(); }
  if (a === 'loan-log') {
    const ym = C.monthKey(C.todayISO());
    await commit((s) => { if (!s.loan.log.some((x) => x.month === ym)) s.loan.log.push({ month: ym, at: new Date().toISOString() }); });
    toast('Payment logged.'); return render();
  }
  if (a === 'loan-undo') { await commit((s) => { s.loan.log.pop(); }); toast('Last payment removed.'); return render(); }
  if (a === 'del-bill') { if (!twoTap(t)) return; await commit((s) => { s.bills = s.bills.filter((b) => b.id !== t.dataset.id); }); toast('Bill removed.'); return render(); }
  if (a === 'del-contrib') { if (!twoTap(t)) return; await commit((s) => { s.contributions = s.contributions.filter((b) => b.id !== t.dataset.id); }); return render(); }
  if (a === 'del-task') { if (!twoTap(t)) return; await commit((s) => { s.tasks = s.tasks.filter((b) => b.id !== t.dataset.id); }); return render(); }
  if (a === 'download') return downloadBackup();
  if (a === 'copy-backup') { await copyText(S.toBackup(markBackup()), 'Backup copied. Paste it somewhere safe, like a note or an email to yourself.'); await S.save(state); return render(); }
  if (a === 'paste-restore') { const txt = $('#paste-box').value.trim(); if (!txt) return toast('Paste your backup text first.'); return startRestore(txt); }
  if (a === 'delete-all') return deleteAll();
  // setup
  if (a === 'su-back') { readSetupStep(); ui.setupStep = Math.max(0, ui.setupStep - 1); return render(); }
  if (a === 'su-skip') { ui.setupStep++; if (ui.setupStep >= SETUP_STEPS.length) return finishSetup(); return render(); }
  if (a === 'su-sugg') { $('#su-bname').value = t.dataset.name; $('#su-bamt').focus(); return; }
  if (a === 'su-add-bill') return setupAddBill();
  if (a === 'su-add-income') return setupAddIncome();
  if (a === 'su-del-income') { ui.draft.incomes.splice(Number(t.dataset.i), 1); return render(); }
  if (a === 'su-inc-preset' || a === 'inc-preset') {
    const pre = a === 'su-inc-preset' ? 'su-i' : 'ni-';
    $(`#${pre}name`).value = t.dataset.name; $(`#${pre}freq`).value = t.dataset.freq;
    $(`#${pre}count-wrap`).hidden = t.dataset.freq !== 'perYear';
    $(`#${pre === 'su-i' ? 'su-iamt' : 'ni-amount'}`).focus(); return;
  }
  if (a === 'del-income') { if (!twoTap(t)) return; await commit((s) => { s.incomes = s.incomes.filter((x) => x.id !== t.dataset.id); }); toast('Income removed.'); return render(); }
  if (a === 'su-del-bill') { ui.draft.bills.splice(Number(t.dataset.i), 1); return render(); }
}

function readIncomeForm(pre, amountId, errId) {
  const name = $(`#${pre}name`).value.trim();
  const amount = C.parseMoney($(`#${amountId}`).value);
  const freq = $(`#${pre}freq`).value;
  const count = freq === 'perYear' ? Number($(`#${pre}count`).value) : null;
  const err = $(`#${errId}`);
  if (!name) { err.textContent = 'Give this income a name, like “Spouse’s pay”.'; $(`#${pre}name`).focus(); return null; }
  if (amount == null || amount < 0) { err.textContent = 'Enter the take-home amount per payment, like 3500.'; $(`#${amountId}`).focus(); return null; }
  if (freq === 'perYear' && !(count > 0)) { err.textContent = 'Enter about how many times a year it comes in, like 4.'; $(`#${pre}count`).focus(); return null; }
  err.textContent = '';
  return { name, amount, freq, count, reliable: freq !== 'perYear' };
}
function setupAddIncome() {
  const x = readIncomeForm('su-i', 'su-iamt', 'su-error');
  if (!x) return;
  ui.draft.incomes.push(x);
  render();
  $('#su-iname').focus();
}
function setupAddBill() {
  const name = $('#su-bname').value.trim();
  const amount = C.parseMoney($('#su-bamt').value);
  const err = $('#su-error');
  if (!name) { err.textContent = 'Give the bill a name.'; $('#su-bname').focus(); return; }
  if (amount == null || amount < 0) { err.textContent = 'Enter the monthly amount as a number, like 85 or 85.50.'; $('#su-bamt').focus(); return; }
  ui.draft.bills.push({ name, amount });
  render();
  $('#su-bname').focus();
}

async function onSubmit(e) {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if (kind === 'weekly') return saveWeekly();
  if (kind === 'monthly') return saveMonthly();
  if (kind === 'add-bill') {
    const name = $('#nb-name').value.trim(); const amount = C.parseMoney($('#nb-amount').value);
    if (!name || amount == null || amount < 0) { $('#nb-error').textContent = !name ? 'Give the bill a name.' : 'Enter the monthly amount as a number.'; return; }
    await commit((s) => s.bills.push({ id: S.uid(), name, amount, category: $('#nb-cat').value.trim() || guessCategory(name), endMonth: $('#nb-end').value || null }));
    toast(`${name} added.`); return render();
  }
  if (kind === 'add-income') {
    const x = readIncomeForm('ni-', 'ni-amount', 'ni-error');
    if (!x) return;
    await commit((s) => s.incomes.push({ id: S.uid(), ...x }));
    toast(`${x.name} added.`); return render();
  }
  if (kind === 'add-contrib') {
    const name = $('#nc-name').value.trim(); const amount = C.parseMoney($('#nc-amount').value);
    if (!name || amount == null) return toast('Add a name and a monthly amount.');
    await commit((s) => s.contributions.push({ id: S.uid(), name, amount })); return render();
  }
  if (kind === 'add-task') {
    const text = $('#nt-text').value.trim(); if (!text) return;
    const repeat = $('#nt-rep').value;
    await commit((s) => s.tasks.push({ id: S.uid(), text, repeat, done: false, doneWeeks: [] })); return render();
  }
  if (kind === 'setup') {
    const step = SETUP_STEPS[ui.setupStep];
    if (step === 'bills' && $('#su-bname').value.trim()) { setupAddBill(); if ($('#su-error').textContent) return; }
    if (step === 'income' && $('#su-iname').value.trim()) { const x = readIncomeForm('su-i', 'su-iamt', 'su-error'); if (!x) return; ui.draft.incomes.push(x); }
    readSetupStep();
    if (step === 'balances' && ui.draft.savings == null) { $('#su-error').textContent = 'Enter your savings balance. Zero is fine.'; $('#su-savings').focus(); return; }
    ui.setupStep++;
    if (ui.setupStep >= SETUP_STEPS.length) return finishSetup();
    return render();
  }
}

async function saveWeekly() {
  const err = $('#ci-error');
  const date = $('#ci-date').value;
  const savings = C.parseMoney($('#ci-savings').value);
  const checking = C.parseMoney($('#ci-checking').value);
  const spent = C.parseMoney($('#ci-spent').value);
  const extraIncome = C.parseMoney($('#ci-extra').value);
  const debt = $('input[name="newDebt"]:checked')?.value;
  const win = $('#ci-win').value.trim().slice(0, 140);
  if (!date || date > C.todayISO()) { err.textContent = 'Pick today or an earlier date.'; return $('#ci-date').focus(); }
  if (savings == null) { err.textContent = 'Enter your savings balance. Zero is fine.'; return $('#ci-savings').focus(); }
  if ($('#ci-checking').value.trim() && checking == null) { err.textContent = 'Checking should be a number, like 412.50.'; return $('#ci-checking').focus(); }
  if ($('#ci-spent').value.trim() && spent == null) { err.textContent = 'Spending should be a number, like 120.'; return $('#ci-spent').focus(); }
  if ($('#ci-extra').value.trim() && extraIncome == null) { err.textContent = 'Extra income should be a number, like 3750.'; return $('#ci-extra').focus(); }
  if (!debt) { err.textContent = 'Choose yes or no for new debt.'; return $('input[name="newDebt"]').focus(); }

  const week = C.weekKey(date);
  const before = { level: C.levelInfo(C.totalXP(state)).level, badges: new Set(Object.keys(state.badges)) };
  const existing = state.checkins.find((c) => c.week === week);
  const prior = C.sortedCheckins(state).filter((c) => c.week < week);
  const prev = prior[prior.length - 1];
  const entry = { week, date, savings, checking, spent, extraIncome, newDebt: debt === 'yes', win: win || null, xp: 0, savedAt: new Date().toISOString() };
  let fresh = [];
  await commit((s) => {
    s.checkins = s.checkins.filter((c) => c.week !== week);
    s.checkins.push(entry);
    const streak = C.streakInfo(s).streak;
    const x = C.checkinXP(entry, prev, Math.max(1, streak), { weeklySpending: s.plan.weeklySpending, startSavings: s.start?.savings });
    entry.xp = x.total; entry.xpParts = x.parts;
    fresh = C.awardBadges(s);
  });
  const nw = C.netWorthAt(state, C.todayISO());
  const prevSavings = prev ? prev.savings : state.start?.savings ?? savings;
  const lvAfter = C.levelInfo(C.totalXP(state));
  const st = C.streakInfo(state);
  ui.reward = {
    updated: !!existing,
    isFirst: !prev && !existing && state.checkins.length === 1,
    savingsChange: savings - prevSavings,
    months: C.bufferMonths(state),
    sinceStart: state.start ? nw - state.start.netWorth : null,
    xp: entry.xp + fresh.length * 25,
    streak: st.streak,
    level: lvAfter.level,
    levelUp: lvAfter.level > before.level,
    badges: fresh,
    xpParts: [...entry.xpParts, ...fresh.map((b) => [`Badge: ${b.name}`, 25])],
    highlights: C.highlights(state).slice(0, 4),
  };
  ui.reward.line = C.rewardLine({ savingsChange: ui.reward.savingsChange, isFirst: ui.reward.isFirst, newDebt: entry.newDebt, streak: st.streak });
  if (location.hash !== '#checkin') history.replaceState(null, '', '#checkin');
  lastRoute = '';
  render();
  if (fresh.some((b) => b.celebrate)) confetti();
}

async function saveMonthly() {
  const v = readMonthlyInputs();
  const err = $('#mo-error');
  const today = C.todayISO();
  if (!v.month || v.month > C.monthKey(today)) { err.textContent = 'Pick this month or an earlier one.'; return; }
  for (const f of C.ACCOUNT_FIELDS) { const raw = $(`#mo-${f.key}`).value.trim(); if (raw && v[f.key] == null) { err.textContent = `${f.label} should be a number.`; return $(`#mo-${f.key}`).focus(); } }
  const date = v.month === C.monthKey(today) ? today : C.endOfMonth(v.month);
  let fresh = [];
  await commit((s) => {
    s.monthly = s.monthly.filter((m) => m.month !== v.month);
    s.monthly.push({ ...v, date });
    fresh = C.awardBadges(s);
  });
  const ms = C.sortedMonthly(state);
  const i = ms.findIndex((m) => m.month === v.month);
  const worth = C.monthlyWorth(state, ms[i]);
  ui.monthlyResult = { worth, change: i > 0 ? worth - C.monthlyWorth(state, ms[i - 1]) : null };
  render();
  toast(`Monthly update saved.${fresh.length ? ` New badge: ${fresh.map((b) => b.name).join(', ')}.` : ''}`);
  if (fresh.some((b) => b.celebrate)) confetti();
}

async function onChange(e) {
  const t = e.target;
  if (t.matches('[data-task]')) {
    const wk = C.weekKey(C.todayISO());
    await commit((s) => {
      const task = s.tasks.find((x) => x.id === t.dataset.task); if (!task) return;
      if (task.repeat === 'weekly') { task.doneWeeks = (task.doneWeeks || []).filter((w) => w !== wk); if (t.checked) task.doneWeeks.push(wk); }
      else { task.done = t.checked; task.doneAt = t.checked ? C.todayISO() : null; }
    });
    if (t.checked) toast('+10 XP');
    return;
  }
  if (t.matches('[data-bill]') || t.matches('[data-contrib]')) {
    const list = t.dataset.bill ? 'bills' : 'contributions';
    const id = t.dataset.bill || t.dataset.contrib;
    const field = t.dataset.field;
    let v = t.value;
    if (field === 'amount') { v = C.parseMoney(v); if (v == null) { toast('Amounts need to be numbers.'); return render(); } }
    if (field === 'name') { v = v.trim(); if (!v) return render(); }
    if (field === 'endMonth') v = v || null;
    await commit((s) => { const item = s[list].find((x) => x.id === id); if (item) item[field] = v; });
    return render();
  }
  if (t.id === 'ni-freq' || t.id === 'su-ifreq') { $(`#${t.id === 'ni-freq' ? 'ni-' : 'su-i'}count-wrap`).hidden = t.value !== 'perYear'; return; }
  if (t.matches('[data-income]')) {
    const id = t.dataset.income, field = t.dataset.field;
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (field === 'amount') { v = C.parseMoney(v); if (v == null) { toast('Amounts need to be numbers.'); return render(); } }
    if (field === 'count') { v = Number(v); if (!(v > 0)) { toast('Enter how many times a year, like 4.'); return render(); } }
    if (field === 'name') { v = v.trim(); if (!v) return render(); }
    await commit((s) => {
      const x = s.incomes.find((i) => i.id === id); if (!x) return;
      x[field] = v;
      if (field === 'freq') { if (v === 'perYear') { x.count = x.count || 4; x.reliable = false; } else { x.count = null; } }
    });
    return render();
  }
  if (t.matches('[data-plan]')) {
    const v = C.parseMoney(t.value);
    if (t.value.trim() && v == null) { toast('Use numbers only, like 1450.'); return; }
    await commit((s) => { s.plan[t.dataset.plan] = v; });
    return render();
  }
  if (t.matches('[data-taskedit]')) {
    await commit((s) => { const task = s.tasks.find((x) => x.id === t.dataset.taskedit); if (task) task[t.dataset.field] = t.dataset.field === 'text' ? t.value.trim() || task.text : t.value; });
    return;
  }
  if (t.id === 'mo-month') { ui.monthlyMonth = t.value; ui.monthlyResult = null; return render(); }
  if (t.id === 'ci-date') {
    const ex = state.checkins.find((c) => c.week === C.weekKey(t.value));
    const note = $('#week-note');
    if (note) { note.hidden = !ex; if (ex) note.textContent = `You already checked in for the week of ${C.dateLabel(ex.week)}. Saving again updates it.`; }
    return;
  }
  if (t.id === 'restore-file') {
    const file = t.files?.[0]; if (!file) return;
    const text = await file.text(); t.value = '';
    return startRestore(text);
  }
  if (t.id === 'loan-on') { await commit((s) => { s.loan.enabled = t.checked; }); toast(t.checked ? 'Loan counter is on Home.' : 'Loan counter hidden.'); return; }
  if (t.id === 'loan-rem') { const n = parseInt(t.value, 10); await commit((s) => { s.loan.startRemaining = Number.isFinite(n) && n >= 0 ? n : null; }); return; }
}

function onInput(e) {
  const t = e.target;
  if (t.id === 'ci-win') { const c = $('#win-count'); if (c) c.textContent = `${t.value.length}/140`; }
  if (t.closest('form[data-form="monthly"]')) monthlyPreview();
}

// ---------- Backup & restore ----------
function markBackup() { state.settings.lastBackupAt = new Date().toISOString(); C.awardBadges(state); return state; }

async function downloadBackup() {
  const text = S.toBackup(markBackup());
  await S.save(state);
  const name = `month-ahead-backup-${C.todayISO()}.json`;
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (isIOS && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Month Ahead backup' });
      toast('Backup ready. Choose “Save to Files” to keep it.');
      return render();
    }
  } catch (err) { if (err?.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup downloaded.');
  render();
}

async function startRestore(text) {
  let incoming;
  try { incoming = S.fromBackup(text); } catch (err) { return toast(err.message); }
  const ok = await confirmDialog({
    title: 'Replace your current data?',
    body: `This backup has ${incoming.checkins.length} weekly check-ins, ${incoming.monthly.length} monthly updates and ${incoming.bills.length} bills. Restoring replaces everything currently in Month Ahead on this device.`,
    confirm: 'Replace with backup', danger: true,
  });
  if (!ok) return;
  state = incoming;
  await S.save(state);
  ui.reward = null; ui.draft = null; ui.setupStep = 0;
  location.hash = state.settings.setupDone ? '#home' : '#setup';
  render();
  toast('Backup restored.');
}

async function deleteAll() {
  const one = await confirmDialog({ title: 'Delete all your data?', body: 'Every check-in, bill, balance, badge and task will be removed from this device.', confirm: 'Continue', danger: true });
  if (!one) return;
  const two = await confirmDialog({ title: 'This can’t be undone', body: 'There is no copy anywhere else unless you downloaded a backup. Delete everything now?', confirm: 'Delete everything', danger: true });
  if (!two) return;
  await S.wipe();
  state = S.emptyState();
  ui.draft = null; ui.setupStep = 0; ui.reward = null;
  location.hash = '#setup';
  render();
  toast('All data deleted.');
}

// ---------- Dialog, toast, clipboard, confetti ----------
function confirmDialog({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const d = $('#dialog');
    d.innerHTML = `<form method="dialog"><h2 id="dlg-t">${esc(title)}</h2><p id="dlg-b">${esc(body)}</p>
      <div class="row end"><button class="btn ghost" value="cancel" autofocus>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${esc(confirm)}</button></div></form>`;
    d.setAttribute('aria-labelledby', 'dlg-t'); d.setAttribute('aria-describedby', 'dlg-b');
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return; } catch { /* fall back */ }
  const d = $('#dialog');
  d.innerHTML = `<form method="dialog"><h2>Copy this text</h2><p class="small muted">Select all and copy.</p><textarea class="copy-box" rows="10" readonly>${esc(text)}</textarea><div class="row end"><button class="btn primary" value="ok">Done</button></div></form>`;
  d.showModal();
  const ta = $('.copy-box', d); ta.focus(); ta.select();
}

function confetti() {
  if (reduceMotion()) return;
  const c = $('#confetti'); const ctx = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--accent', '--gold', '--sky', '--good'].map((v) => cs.getPropertyValue(v).trim() || '#2a8');
  const parts = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3, r: Math.random() * Math.PI, s: 5 + Math.random() * 5, col: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  c.hidden = false;
  (function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) { p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.r += 0.1; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col; ctx.globalAlpha = Math.max(0, 1 - el / 1800); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    if (el < 1800) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, innerWidth, innerHeight); c.hidden = true; }
  })(t0);
}

// ---------- Service worker (offline + updates) ----------
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    ui.swReg = reg;
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) { ui.updateReady = true; render(); } };
    check();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') check(); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ui.applyingUpdate && !reloading) { reloading = true; location.reload(); }
  });
}

// ---------- Boot ----------
async function boot() {
  try { state = await S.load(); }
  catch (err) { state = S.emptyState(); toast(err.message || 'Could not read saved data.'); }
  ui.persisted = await S.persistStatus();
  bindGlobal();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; render(); });
  render();
  setupServiceWorker();
  if (state.settings.setupDone && ui.persisted === false && isStandalone()) ui.persisted = await S.requestPersist();
}
boot();
