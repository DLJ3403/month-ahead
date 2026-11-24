// Month Ahead — pure calculations. No DOM, no storage, no network.
// Everything here is derived from the saved state so it can be recomputed at any time.

// ---------- Money ----------
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 });

export function money(n, { cents = true } = {}) {
  if (n == null || Number.isNaN(n)) return '—';
  return (cents ? usd : usd0).format(n);
}
/** Whole-dollar format; keeps cents only when the amount is small. */
export function moneyShort(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.abs(n) < 100 && n % 1 !== 0 ? usd.format(n) : usd0.format(Math.round(n));
}
export function signed(n, short = true) {
  if (n == null || Number.isNaN(n)) return '—';
  const s = short ? moneyShort(Math.abs(n)) : money(Math.abs(n));
  if (Math.round(n * 100) === 0) return s;
  return (n > 0 ? '+' : '−') + s;
}
/** Parse "$1,234.50" style input. Empty → null. */
export function parseMoney(v) {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Dates (local, as YYYY-MM-DD strings) ----------
const pad = (n) => String(n).padStart(2, '0');
export function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function todayISO() { return toISO(new Date()); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
export function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
/** Monday of the week containing iso. */
export function weekKey(iso) { const d = parseISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toISO(d); }
export function monthKey(iso) { return iso.slice(0, 7); }
export function addMonths(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function monthsBetween(a, b) { const [ay, am] = a.split('-').map(Number); const [by, bm] = b.split('-').map(Number); return (by - ay) * 12 + (bm - am); }
export function endOfMonth(ym) { const [y, m] = ym.split('-').map(Number); return toISO(new Date(y, m, 0, 12)); }
export function monthLabel(ym, long = false) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1, 12).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: 'numeric' }); }
export function dateLabel(iso, withYear = false) { return parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }); }

// ---------- Bills & plan ----------
export function billApplies(bill, ym) { return !bill.endMonth || bill.endMonth >= ym; }
export function billsTotal(state, ym = monthKey(todayISO())) {
  return round2(state.bills.filter((b) => billApplies(b, ym)).reduce((s, b) => s + (b.amount || 0), 0));
}
/** Bills that end this month, so they disappear from next month's total. */
export function billsEndingAfter(state, ym = monthKey(todayISO())) {
  return state.bills.filter((b) => b.endMonth === ym && (b.amount || 0) > 0);
}
export function contributionsTotal(state) { return round2(state.contributions.reduce((s, c) => s + (c.amount || 0), 0)); }

// ---------- Income ----------
export const FREQS = {
  weekly: { label: 'Every week', perYear: 52 },
  biweekly: { label: 'Every two weeks', perYear: 26 },
  semimonthly: { label: 'Twice a month', perYear: 24 },
  monthly: { label: 'Once a month', perYear: 12 },
  perYear: { label: 'A few times a year', perYear: null },
};
/** Average monthly amount for one income source. */
export function incomeMonthly(src) {
  if (!src || src.amount == null) return 0;
  const n = src.freq === 'perYear' ? (src.count || 0) : FREQS[src.freq]?.perYear || 0;
  return round2((src.amount * n) / 12);
}
export function incomeDescription(src) {
  if (src.freq === 'perYear') return `${money(src.amount)} each, about ${src.count || 0} a year`;
  return `${money(src.amount)} ${FREQS[src.freq]?.label.toLowerCase() || ''}`;
}

export function planMonthly(state) {
  const pl = state.plan || {};
  const incomes = state.incomes || [];
  const reliable = round2(incomes.filter((s) => s.reliable !== false).reduce((s, x) => s + incomeMonthly(x), 0));
  const irregular = round2(incomes.filter((s) => s.reliable === false).reduce((s, x) => s + incomeMonthly(x), 0));
  const income = incomes.length ? round2(reliable + irregular) : null;
  const toSavings = pl.savingsMonthly ?? null;
  const spending = pl.weeklySpending != null ? round2(pl.weeklySpending * 52 / 12) : null;
  const bills = billsTotal(state);
  const contrib = contributionsTotal(state);
  const out = bills + contrib + (toSavings || 0) + (spending || 0);
  const leftover = income != null ? round2(income - out) : null;
  const leftoverReliable = income != null ? round2(reliable - out) : null;
  const weeklySavingsPlan = toSavings != null ? round2(toSavings * 12 / 52) : null;
  return { income, reliable, irregular, toSavings, spending, bills, contrib, leftover, leftoverReliable, weeklySavingsPlan };
}

// ---------- Balances & net worth ----------
export const ACCOUNT_FIELDS = [
  { key: 'retirement1', label: 'Retirement account 1', kind: 'asset' },
  { key: 'retirement2', label: 'Retirement account 2', kind: 'asset' },
  { key: 'college', label: 'College savings', kind: 'asset' },
  { key: 'homeValue', label: 'Home value', kind: 'asset' },
  { key: 'mortgage', label: 'Mortgage owed', kind: 'debt' },
  { key: 'studentLoan', label: 'Student loan', kind: 'debt' },
  { key: 'carLoans', label: 'Car loans', kind: 'debt' },
  { key: 'creditCards', label: 'Credit cards', kind: 'debt' },
];

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
export function sortedCheckins(state) { return [...state.checkins].sort(byDate); }
export function sortedMonthly(state) { return [...state.monthly].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0)); }

/** Cash (savings + checking) known as of a date. */
export function cashAt(state, iso) {
  const cs = sortedCheckins(state).filter((c) => c.date <= iso);
  const start = state.start && state.start.date <= iso ? state.start : null;
  const last = cs[cs.length - 1];
  const savings = last ? last.savings : start ? start.savings ?? 0 : 0;
  let checking = start ? start.checking ?? 0 : 0;
  for (const c of cs) if (c.checking != null) checking = c.checking;
  return { savings, checking };
}
export function accountsAt(state, iso) {
  const ms = sortedMonthly(state).filter((m) => m.date <= iso);
  return ms[ms.length - 1] || null;
}
export function netWorthAt(state, iso) {
  const { savings, checking } = cashAt(state, iso);
  const m = accountsAt(state, iso);
  let total = (savings || 0) + (checking || 0);
  if (m) for (const f of ACCOUNT_FIELDS) total += (f.kind === 'asset' ? 1 : -1) * (m[f.key] || 0);
  return round2(total);
}
export function monthlyWorth(state, entry) { return netWorthAt(state, entry.date); }
export function debtsOf(m) { return m ? ACCOUNT_FIELDS.filter((f) => f.kind === 'debt').reduce((s, f) => s + (m[f.key] || 0), 0) : 0; }

// ---------- Cash flow: surpluses and spending ----------
const cashTotal = (state, iso) => { const c = cashAt(state, iso); return round2((c.savings || 0) + (c.checking || 0)); };

/** Per month: cash (savings + checking) at the month's last check-in, and the change from the month before.
 *  A positive change is a surplus: more came in than went out. */
export function monthlySurpluses(state) {
  const cs = sortedCheckins(state);
  const lastByMonth = new Map();
  for (const c of cs) lastByMonth.set(monthKey(c.date), c);
  const points = [];
  if (state.start) points.push({ month: monthKey(state.start.date), date: state.start.date, cash: round2((state.start.savings || 0) + (state.start.checking || 0)), isStart: true });
  for (const [month, c] of [...lastByMonth].sort()) points.push({ month, date: c.date, cash: cashTotal(state, c.date) });
  const current = monthKey(todayISO());
  const out = [];
  for (let i = 1; i < points.length; i++) {
    out.push({ month: points[i].month, cash: points[i].cash, change: round2(points[i].cash - points[i - 1].cash), complete: points[i].month < current });
  }
  return out;
}

/** Spending vs plan for each check-in that recorded spending. */
export function spendingWeeks(state) {
  const plan = state.plan?.weeklySpending;
  return sortedCheckins(state).filter((c) => c.spent != null).map((c) => ({ date: c.date, spent: c.spent, plan, under: plan != null && c.spent <= plan }));
}
export function underBudgetStreak(state) {
  const w = spendingWeeks(state);
  let n = 0;
  for (let i = w.length - 1; i >= 0 && w[i].under; i--) n++;
  return n;
}
/** Average spending of the last 4 recorded weeks vs the 4 before. */
export function spendingTrend(state) {
  const w = spendingWeeks(state);
  if (w.length < 6) return null;
  const recent = w.slice(-4), before = w.slice(-8, -4);
  const avg = (a) => a.reduce((s, x) => s + x.spent, 0) / a.length;
  const a = avg(recent), b = avg(before);
  if (!b) return null;
  return { recent: a, before: b, change: (a - b) / b };
}
export function noDebtStreak(state) {
  const cs = sortedCheckins(state);
  let n = 0;
  for (let i = cs.length - 1; i >= 0 && cs[i].newDebt === false; i--) n++;
  return n;
}
/** Share of a week's extra income that ended up in savings (0–1), or null. */
export function bankedShare(c, prev, startSavings) {
  if (!c || !c.extraIncome || c.extraIncome <= 0) return null;
  const base = prev ? prev.savings : startSavings;
  if (base == null) return null;
  return Math.max(0, Math.min(1, (c.savings - base) / c.extraIncome));
}

// ---------- Highlights: positive reinforcement for more than savings ----------
/** Things that went well, most notable first. Each: { kind, title, text }. */
export function highlights(state) {
  const out = [];
  const cs = sortedCheckins(state);
  const last = cs[cs.length - 1], prev = cs[cs.length - 2];
  const today = todayISO();

  // Extra income banked
  if (last) {
    const share = bankedShare(last, prev, state.start?.savings);
    if (share != null && share >= 0.25) out.push({ kind: 'extra', title: `Banked ${Math.round(share * 100)}% of your extra income`, text: `${moneyShort(last.extraIncome)} came in on top of your regular pay, and ${moneyShort(share * last.extraIncome)} of it stayed in savings.` });
  }
  // Surplus month
  const sur = monthlySurpluses(state);
  const lastDone = [...sur].reverse().find((m) => m.complete);
  const thisMonth = sur.find((m) => m.month === monthKey(today));
  if (lastDone && lastDone.change > 0) out.push({ kind: 'surplus', title: `${monthLabel(lastDone.month, true).split(' ')[0]} ended ${moneyShort(lastDone.change)} ahead`, text: 'You finished the month with more cash than you started it with. That is a surplus month.' });
  if (thisMonth && thisMonth.change > 0) out.push({ kind: 'surplus', title: `Up ${moneyShort(thisMonth.change)} so far this month`, text: 'Savings plus checking are higher than at the end of last month.' });
  const surplusCount = sur.filter((m) => m.complete && m.change > 0).length;
  if (surplusCount >= 2) out.push({ kind: 'surplus', title: `${surplusCount} surplus months`, text: 'Months where you came out ahead. Each one is a month you were not living paycheck to paycheck.' });
  // Spending
  if (last && last.spent != null && state.plan?.weeklySpending != null && last.spent <= state.plan.weeklySpending) {
    const n = underBudgetStreak(state);
    out.push({ kind: 'spending', title: n > 1 ? `${n} weeks in a row under your spending plan` : 'Under your spending plan this week', text: `You spent ${moneyShort(last.spent)} of ${moneyShort(state.plan.weeklySpending)}, leaving ${moneyShort(state.plan.weeklySpending - last.spent)} unspent.` });
  }
  const trend = spendingTrend(state);
  if (trend && trend.change <= -0.05) out.push({ kind: 'spending', title: `Spending down ${Math.round(-trend.change * 100)}%`, text: `Your last four weeks averaged ${moneyShort(trend.recent)}, down from ${moneyShort(trend.before)} the four weeks before.` });
  // Debt
  const ms = sortedMonthly(state);
  if (ms.length >= 2) {
    const [a, b] = ms.slice(-2);
    const drop = debtsOf(a) - debtsOf(b);
    if (drop > 1) out.push({ kind: 'debt', title: `Debt down ${moneyShort(drop)}`, text: `Total owed fell between ${monthLabel(a.month)} and ${monthLabel(b.month)}.` });
  }
  const nd = noDebtStreak(state);
  if (nd >= 2) out.push({ kind: 'debt', title: `${nd} check-ins with no new debt`, text: 'Every week without borrowing keeps your progress yours.' });
  // Net worth high
  if (cs.length >= 2) {
    const nw = netWorthAt(state, today);
    const pastMax = Math.max(state.start?.netWorth ?? -Infinity, ...cs.slice(0, -1).map((c) => netWorthAt(state, c.date)));
    if (nw > pastMax) out.push({ kind: 'worth', title: 'New net worth high', text: `${money(nw, { cents: false })} is the highest since you started tracking.` });
  }
  // Logging consistency
  const st = streakInfo(state);
  if (st.streak >= 2) out.push({ kind: 'logging', title: `${st.streak}-week check-in streak`, text: 'Looking at your numbers every week is the habit everything else is built on.' });
  if (ms.length && ms[ms.length - 1].month === monthKey(today)) out.push({ kind: 'logging', title: 'Monthly update done', text: 'Your full picture is current for this month.' });
  return out;
}

// ---------- Buffer ----------
export const BUFFER_TARGETS = [1, 3, 6];
export function bufferMonths(state) {
  const bills = billsTotal(state);
  const { savings } = cashAt(state, todayISO());
  if (!bills) return null;
  return savings / bills;
}

/** Savings change per week, from up to the last 8 weeks of check-ins (least squares). */
export function savingsPace(state) {
  const cs = sortedCheckins(state);
  const recent = cs.filter((c) => daysBetween(c.date, todayISO()) <= 63);
  if (recent.length >= 2) {
    const pts = recent.map((c) => [daysBetween(recent[0].date, c.date) / 7, c.savings]);
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n;
    const my = pts.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, den = 0;
    for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
    if (den > 0) return { perWeek: num / den, source: 'recent', weeks: Math.round(pts[n - 1][0]) };
  }
  const plan = planMonthly(state).weeklySavingsPlan;
  if (plan) return { perWeek: plan, source: 'plan' };
  return null;
}

export function nextMilestone(state) {
  const bills = billsTotal(state);
  if (!bills) return null;
  const { savings } = cashAt(state, todayISO());
  const months = savings / bills;
  const target = BUFFER_TARGETS.find((t) => months < t) ?? Math.floor(months) + 1;
  const amount = round2(target * bills);
  const needed = round2(amount - savings);
  const pace = savingsPace(state);
  let projected = null;
  if (pace && pace.perWeek > 0.5) projected = addDays(todayISO(), Math.ceil((needed / pace.perWeek) * 7));
  return { target, amount, needed, pace, projected };
}

// ---------- Streaks, shields, XP, levels ----------
export const SHIELD_CAP = 2;
export function streakInfo(state) {
  const weeks = new Set(state.checkins.map((c) => weekKey(c.date)));
  const current = weekKey(todayISO());
  const all = [...weeks].sort();
  if (!all.length) return { streak: 0, best: 0, shields: 1, shieldUsedWeeks: [], checkedInThisWeek: false, atRisk: false };
  let streak = 0, best = 0, shields = 1, missRun = 0;
  const used = [];
  for (let w = all[0]; w <= current; w = addDays(w, 7)) {
    if (weeks.has(w)) {
      streak++; missRun = 0;
      if (streak % 4 === 0 && shields < SHIELD_CAP) shields++;
      best = Math.max(best, streak);
    } else if (w === current) {
      break; // this week is still open
    } else if (streak > 0 && missRun === 0 && shields > 0) {
      shields--; used.push(w); missRun = 1;
    } else {
      if (streak > 0) shields = Math.max(shields, 1);
      streak = 0; missRun++;
    }
  }
  const checkedInThisWeek = weeks.has(current);
  const lastWeekMissed = !weeks.has(addDays(current, -7));
  return { streak, best, shields, shieldUsedWeeks: used, checkedInThisWeek, atRisk: !checkedInThisWeek && lastWeekMissed && streak > 0 };
}

/** XP for one check-in, given the previous check-in and the streak after saving. */
/** XP for one check-in. Returns { total, parts } so the reward screen can show what earned it. */
export function checkinXP(c, prev, streakAfter, { weeklySpending = null, startSavings = null } = {}) {
  const parts = [['Checked in', 50]];
  if (c.checking != null) parts.push(['Logged checking', 10]);
  if (c.spent != null) parts.push(['Logged spending', 10]);
  if (c.win) parts.push(['Named a win', 10]);
  if (c.newDebt === false) parts.push(['No new debt', 15]);
  if (prev && c.savings > prev.savings) parts.push(['Savings grew', 20]);
  if (c.spent != null && weeklySpending != null && c.spent <= weeklySpending) parts.push(['Under spending plan', 15]);
  const share = bankedShare(c, prev, startSavings);
  if (share != null && share >= 0.5) parts.push(['Banked extra income', 20]);
  if (streakAfter > 0) parts.push([`Streak bonus (${streakAfter} wk)`, 5 * Math.min(streakAfter, 10)]);
  return { total: parts.reduce((s, p) => s + p[1], 0), parts };
}
export function totalXP(state) {
  const fromCheckins = state.checkins.reduce((s, c) => s + (c.xp || 0), 0);
  const ms = sortedMonthly(state);
  const fromMonthly = ms.length * 40 + ms.reduce((s, m, i) => s + (i > 0 && debtsOf(m) < debtsOf(ms[i - 1]) - 1 ? 20 : 0), 0);
  const fromSurplus = monthlySurpluses(state).filter((m) => m.complete && m.change > 0).length * 30;
  const fromTasks = state.tasks.reduce((s, t) => s + 10 * (t.repeat === 'weekly' ? (t.doneWeeks || []).length : t.done ? 1 : 0), 0);
  const fromBadges = Object.keys(state.badges).length * 25;
  return fromCheckins + fromMonthly + fromSurplus + fromTasks + fromBadges;
}
const levelFloor = (n) => 50 * (n - 1) * n; // L1 0, L2 100, L3 300, L4 600, L5 1000…
export function levelInfo(xp) {
  let level = 1;
  while (levelFloor(level + 1) <= xp) level++;
  const floor = levelFloor(level), next = levelFloor(level + 1);
  return { level, xp, floor, next, progress: (xp - floor) / (next - floor), toNext: next - xp };
}

// ---------- Badges ----------
export const BADGES = [
  { id: 'first-checkin', name: 'First check-in', desc: 'Logged your first weekly check-in.' },
  { id: 'streak-4', name: '4-week streak', desc: 'Checked in four weeks running.', celebrate: true },
  { id: 'streak-12', name: '12-week streak', desc: 'A full quarter of weekly check-ins.', celebrate: true },
  { id: 'streak-26', name: '26-week streak', desc: 'Half a year of showing up.', celebrate: true },
  { id: 'streak-52', name: '52-week streak', desc: 'A whole year of check-ins.', celebrate: true },
  { id: 'shield-save', name: 'Saved by a shield', desc: 'A shield kept your streak alive after a missed week.' },
  { id: 'savings-up-3', name: 'Three up', desc: 'Savings grew three check-ins in a row.' },
  { id: 'no-debt-4', name: 'Clean month', desc: 'Four check-ins in a row with no new debt.' },
  { id: 'buffer-half', name: 'Halfway there', desc: 'Half a month of bills saved.' },
  { id: 'buffer-1', name: 'One month ahead', desc: 'A full month of bills saved.', celebrate: true },
  { id: 'buffer-2', name: 'Two months ahead', desc: 'Two months of bills saved.' },
  { id: 'buffer-3', name: 'Three months ahead', desc: 'Three months of bills saved. A real cushion.', celebrate: true },
  { id: 'under-1', name: 'Under plan', desc: 'Spent less than your weekly spending plan.' },
  { id: 'under-4', name: 'Four under', desc: 'Four check-ins in a row under your spending plan.', celebrate: true },
  { id: 'spend-down', name: 'Trimmed', desc: 'Four-week spending average down 10% or more.' },
  { id: 'surplus-1', name: 'Surplus month', desc: 'Finished a month with more cash than you started it with.', celebrate: true },
  { id: 'surplus-3', name: 'Three surplus months', desc: 'Three months where you came out ahead.', celebrate: true },
  { id: 'debt-down', name: 'Debt shrinking', desc: 'Total debt went down between monthly updates.' },
  { id: 'cards-zero', name: 'Cards cleared', desc: 'Credit card balances down to zero.', celebrate: true },
  { id: 'banked-extra', name: 'Banked the bonus', desc: 'Kept at least half of an extra payment in savings.' },
  { id: 'checkins-10', name: '10 check-ins', desc: 'Ten weekly check-ins logged.' },
  { id: 'checkins-25', name: '25 check-ins', desc: 'Twenty-five weekly check-ins logged.' },
  { id: 'first-monthly', name: 'Big picture', desc: 'Saved your first monthly update.' },
  { id: 'net-up', name: 'Net worth up', desc: 'Total worth is higher than when you started.' },
  { id: 'first-backup', name: 'Safe copy', desc: 'Downloaded or copied your first backup.' },
];

export function earnedBadgeIds(state) {
  const ids = new Set();
  const cs = sortedCheckins(state);
  const st = streakInfo(state);
  if (cs.length) ids.add('first-checkin');
  for (const n of [4, 12, 26, 52]) if (st.best >= n) ids.add(`streak-${n}`);
  if (st.shieldUsedWeeks.length) ids.add('shield-save');
  let up = 0, noDebt = 0;
  for (let i = 0; i < cs.length; i++) {
    up = i > 0 && cs[i].savings > cs[i - 1].savings ? up + 1 : 0;
    noDebt = cs[i].newDebt === false ? noDebt + 1 : 0;
    if (up >= 3) ids.add('savings-up-3');
    if (noDebt >= 4) ids.add('no-debt-4');
  }
  const b = bufferMonths(state);
  if (b != null) {
    if (b >= 0.5) ids.add('buffer-half');
    if (b >= 1) ids.add('buffer-1');
    if (b >= 2) ids.add('buffer-2');
    if (b >= 3) ids.add('buffer-3');
  }
  if (cs.length >= 10) ids.add('checkins-10');
  if (cs.length >= 25) ids.add('checkins-25');
  const sw = spendingWeeks(state);
  let run = 0;
  for (const w of sw) { run = w.under ? run + 1 : 0; if (run >= 1) ids.add('under-1'); if (run >= 4) ids.add('under-4'); }
  const tr = spendingTrend(state);
  if (tr && tr.change <= -0.1) ids.add('spend-down');
  const surplusMonths = monthlySurpluses(state).filter((m) => m.complete && m.change > 0).length;
  if (surplusMonths >= 1) ids.add('surplus-1');
  if (surplusMonths >= 3) ids.add('surplus-3');
  const ms = sortedMonthly(state);
  for (let i = 1; i < ms.length; i++) {
    if (debtsOf(ms[i]) < debtsOf(ms[i - 1]) - 1) ids.add('debt-down');
    if ((ms[i - 1].creditCards || 0) > 0 && ms[i].creditCards === 0) ids.add('cards-zero');
  }
  for (let i = 0; i < cs.length; i++) {
    const share = bankedShare(cs[i], cs[i - 1], state.start?.savings);
    if (share != null && share >= 0.5) ids.add('banked-extra');
  }
  if (state.monthly.length) ids.add('first-monthly');
  if (state.start && cs.length && netWorthAt(state, todayISO()) > state.start.netWorth) ids.add('net-up');
  if (state.settings.lastBackupAt) ids.add('first-backup');
  return ids;
}
/** Adds newly earned badges to state.badges (mutates) and returns them. Badges are never taken away. */
export function awardBadges(state) {
  const now = todayISO();
  const fresh = [];
  for (const id of earnedBadgeIds(state)) {
    if (!state.badges[id]) { state.badges[id] = now; fresh.push(BADGES.find((b) => b.id === id)); }
  }
  return fresh.filter(Boolean);
}

// ---------- Tasks ----------
export function autoTasks(state) {
  const today = todayISO();
  const out = [];
  const st = streakInfo(state);
  if (!st.checkedInThisWeek) out.push({ id: 'auto-checkin', text: st.streak ? `Do this week's check-in to keep your ${st.streak}-week streak` : "Do this week's check-in", href: '#checkin' });
  const thisMonth = monthKey(today);
  if (!state.monthly.some((m) => m.month === thisMonth) && Number(today.slice(8)) >= 1) out.push({ id: 'auto-monthly', text: `Save your ${monthLabel(thisMonth, true).split(' ')[0]} monthly update`, href: '#checkin/monthly' });
  if (backupDue(state)) out.push({ id: 'auto-backup', text: 'Download a backup of your data', href: '#data' });
  return out;
}
export function backupDue(state) {
  const hasData = state.checkins.length || state.monthly.length || state.bills.length;
  if (!hasData) return false;
  const last = state.settings.lastBackupAt;
  return !last || daysBetween(last.slice(0, 10), todayISO()) > 7;
}

// ---------- Loan forgiveness ----------
export function loanInfo(state) {
  const l = state.loan;
  if (!l || !l.enabled || l.startRemaining == null) return null;
  const made = l.log.length;
  const remaining = Math.max(0, l.startRemaining - made);
  const thisMonth = monthKey(todayISO());
  const loggedThisMonth = l.log.some((e) => e.month === thisMonth);
  const firstOpen = loggedThisMonth ? addMonths(thisMonth, 1) : thisMonth;
  const finish = remaining > 0 ? addMonths(firstOpen, remaining - 1) : (l.log[l.log.length - 1]?.month ?? thisMonth);
  return { remaining, made, loggedThisMonth, finish, total: l.startRemaining };
}

// ---------- Encouragement & insights (rule-based, on-device) ----------
export function rewardLine({ savingsChange, isFirst, newDebt, streak }) {
  if (isFirst) return 'First check-in done. This is where the habit starts.';
  if (savingsChange > 0) {
    const lines = ['That is real progress. Future you says thanks.', 'Money moved in the right direction this week.', `Week ${streak} in a row. Steady wins this.`];
    return lines[streak % lines.length];
  }
  if (savingsChange === 0) return 'Holding steady counts. You showed up and checked in.';
  if (newDebt) return 'Tough week, and you still checked in. That honesty is the habit that turns things around.';
  return 'Savings dipped, and that happens. Checking in anyway is what keeps you in charge.';
}

export function insights(state) {
  const out = [];
  const cs = sortedCheckins(state);
  const plan = planMonthly(state);
  const pace = savingsPace(state);
  const p = state.plan || {};
  const ym = monthKey(todayISO());
  const irregularSrc = (state.incomes || []).filter((s) => s.reliable === false && s.amount);

  if (plan.leftover != null && plan.leftover < 0) {
    out.push({ tone: 'heads-up', text: `Your plan spends ${moneyShort(-plan.leftover)} more per month than your household brings in. Trimming weekly spending money or a bill would close the gap.` });
  } else if (plan.leftoverReliable != null && plan.leftoverReliable < 0 && irregularSrc.length) {
    out.push({ tone: 'heads-up', text: `Your plan balances only when ${irregularSrc.map((s) => s.name).join(' and ')} money comes in. In months without it you run about ${moneyShort(-plan.leftoverReliable)} short, so your buffer has to cover those months.` });
  } else if (plan.leftover != null && plan.leftover > 25) {
    out.push({ tone: 'tip', text: `Your plan leaves about ${moneyShort(plan.leftover)} a month unassigned. Sending part of it to savings would speed up your next milestone.` });
  }
  if (irregularSrc.length && plan.leftoverReliable != null && plan.leftoverReliable >= 0) {
    const yearly = irregularSrc.reduce((s, x) => s + incomeMonthly(x) * 12, 0);
    out.push({ tone: 'tip', text: `Your regular pay covers the plan by itself. If half of your ${irregularSrc.map((s) => s.name).join(' and ')} income (about ${moneyShort(yearly)} a year) went straight to savings, that alone would add ${moneyShort(yearly / 2)} a year.` });
  }

  const ending = billsEndingAfter(state, ym);
  if (ending.length) {
    const drop = ending.reduce((s, b) => s + b.amount, 0);
    out.push({ tone: 'good', text: `${ending.map((b) => b.name).join(', ')} ${ending.length > 1 ? 'end' : 'ends'} this month. Moving that ${moneyShort(drop)} to savings would keep your lifestyle the same and grow your buffer fast.` });
  }

  if (pace && pace.source === 'recent' && plan.weeklySavingsPlan) {
    if (pace.perWeek >= plan.weeklySavingsPlan * 0.95) out.push({ tone: 'good', text: `Your savings are growing about ${moneyShort(pace.perWeek)} a week, on or ahead of your plan of ${moneyShort(plan.weeklySavingsPlan)}.` });
    else if (pace.perWeek > 0) out.push({ tone: 'tip', text: `Savings are growing about ${moneyShort(pace.perWeek)} a week. Your plan aims for ${moneyShort(plan.weeklySavingsPlan)}. Is money leaving savings between paychecks?` });
    else out.push({ tone: 'heads-up', text: 'Savings have drifted down over the last few weeks. Look at your weekly log for the week it changed. Naming the cause is half the fix.' });
  }

  const spentWeeks = cs.slice(-4).filter((c) => c.spent != null);
  if (p.weeklySpending && spentWeeks.length >= 2) {
    const avg = spentWeeks.reduce((s, c) => s + c.spent, 0) / spentWeeks.length;
    if (avg > p.weeklySpending * 1.05) out.push({ tone: 'tip', text: `Spending has averaged ${moneyShort(avg)} a week against your ${moneyShort(p.weeklySpending)} plan. Either the plan is too tight or one category is creeping. Both are fixable.` });
    else out.push({ tone: 'good', text: `You have kept spending near ${moneyShort(avg)} a week, within your ${moneyShort(p.weeklySpending)} plan.` });
  }

  const debtWeeks = cs.slice(-4).filter((c) => c.newDebt).length;
  if (debtWeeks >= 2) out.push({ tone: 'heads-up', text: `New debt showed up in ${debtWeeks} of your last 4 check-ins. A bigger buffer is what stops that cycle, so even small savings deposits count.` });

  const ms = sortedMonthly(state);
  if (ms.length >= 2) {
    const [a, b] = ms.slice(-2);
    if ((b.creditCards || 0) > (a.creditCards || 0) + 1) out.push({ tone: 'heads-up', text: `Credit card balances rose ${moneyShort(b.creditCards - a.creditCards)} since last month.` });
    else if ((a.creditCards || 0) > 0 && (b.creditCards || 0) < a.creditCards) out.push({ tone: 'good', text: `Credit card balances fell ${moneyShort(a.creditCards - b.creditCards)} since last month.` });
  }

  const m = nextMilestone(state);
  if (m && m.needed > 0 && m.needed <= billsTotal(state) * 0.15) out.push({ tone: 'good', text: `You are ${moneyShort(m.needed)} from ${m.target} ${m.target === 1 ? 'month' : 'months'} of bills saved. Close.` });

  if (!out.length && !cs.length) out.push({ tone: 'tip', text: 'Do your first weekly check-in. Tips get sharper as your weeks add up.' });
  return out.slice(0, 4);
}

// ---------- Plain-text summary for pasting into an AI chat ----------
export function summaryText(state, { withPrompt = true } = {}) {
  const today = todayISO();
  const L = [];
  if (withPrompt) {
    L.push('I track our household money weekly in an app called Month Ahead. The goal is to stop living paycheck to paycheck: run monthly surpluses, keep spending in check, avoid new debt, pay debt down, and build a cash buffer (first 1 month of bills saved, then 3). Here is my latest summary. Please give me encouraging, specific feedback on how this week and the trend look, and 2 or 3 concrete suggestions for the coming week.');
    L.push('');
  }
  L.push(`MONTH AHEAD SUMMARY (${dateLabel(today, true)})`);
  const nw = netWorthAt(state, today);
  L.push(`Total net worth: ${money(nw)}${state.start ? ` (change since I started on ${dateLabel(state.start.date, true)}: ${signed(nw - state.start.netWorth, false)})` : ''}`);
  const { savings, checking } = cashAt(state, today);
  const bills = billsTotal(state);
  const b = bufferMonths(state);
  L.push(`Savings: ${money(savings)}${b != null ? ` (${b.toFixed(1)} months of bills)` : ''}`);
  L.push(`Checking: ${money(checking)}`);
  L.push(`Monthly bills: ${money(bills)}`);
  const ending = billsEndingAfter(state, monthKey(today));
  if (ending.length) L.push(`Bills ending after this month: ${ending.map((x) => `${x.name} (${money(x.amount)})`).join(', ')}`);
  const plan = planMonthly(state);
  const p = state.plan || {};
  if ((state.incomes || []).length) {
    L.push('Household take-home income:');
    for (const s of state.incomes) L.push(`- ${s.name}: ${incomeDescription(s)} (about ${money(incomeMonthly(s))}/mo${s.reliable === false ? ', irregular' : ''})`);
    L.push(`Average monthly income: ${money(plan.income)} (reliable: ${money(plan.reliable)}, irregular: ${money(plan.irregular)})`);
    L.push(`Plan: ${money(p.savingsMonthly ?? 0)}/month to savings; ${money(p.weeklySpending ?? 0)}/week spending money.`);
    L.push(`Unassigned each month after bills, contributions, savings and spending: ${money(plan.leftover)} on average, ${money(plan.leftoverReliable)} on reliable income only.`);
  }
  const sur = monthlySurpluses(state).slice(-4);
  if (sur.length) L.push(`Monthly cash change (savings + checking): ${sur.map((m) => `${monthLabel(m.month)} ${signed(m.change, false)}${m.complete ? '' : ' so far'}`).join('; ')}`);
  const hl = highlights(state);
  if (hl.length) L.push(`Recent wins the app noticed: ${hl.map((h) => h.title).join('; ')}.`);
  if (state.contributions.length) L.push(`Savings contributions (not bills): ${state.contributions.map((c) => `${c.name} ${money(c.amount)}/mo`).join(', ')}`);
  const m = nextMilestone(state);
  if (m) L.push(`Next milestone: ${m.target} months of bills (${money(m.amount)}), ${money(Math.max(0, m.needed))} to go.${m.projected ? ` Projected ${dateLabel(m.projected, true)} at ${moneyShort(m.pace.perWeek)}/week.` : ''}`);
  const st = streakInfo(state);
  const lv = levelInfo(totalXP(state));
  L.push(`Check-in streak: ${st.streak} weeks (best ${st.best}). Level ${lv.level}.`);
  const cs = sortedCheckins(state).slice(-6);
  if (cs.length) {
    L.push('');
    L.push('Recent weekly check-ins:');
    for (const c of cs) {
      L.push(`- ${dateLabel(c.date, true)}: savings ${money(c.savings)}${c.checking != null ? `, checking ${money(c.checking)}` : ''}${c.spent != null ? `, spent ${money(c.spent)}` : ''}${c.extraIncome ? `, extra income ${money(c.extraIncome)}` : ''}, new debt: ${c.newDebt ? 'yes' : 'no'}${c.win ? `, win: "${c.win}"` : ''}`);
    }
  }
  const ms = sortedMonthly(state);
  const last = ms[ms.length - 1];
  if (last) {
    L.push('');
    L.push(`Accounts (monthly update for ${monthLabel(last.month, true)}):`);
    for (const f of ACCOUNT_FIELDS) if (last[f.key] != null) L.push(`- ${f.label}: ${money(last[f.key])}`);
    if (ms.length >= 2) L.push(`Total worth change vs previous update: ${signed(monthlyWorth(state, last) - monthlyWorth(state, ms[ms.length - 2]), false)}`);
  }
  const loan = loanInfo(state);
  if (loan) L.push(`Loan forgiveness: ${loan.remaining} qualifying payments left, projected finish ${monthLabel(loan.finish, true)}.`);
  return L.join('\n');
}
