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

export function planMonthly(state) {
  const p = state.paycheck || {};
  const income = p.takeHome != null ? round2(p.takeHome * 26 / 12) : null;
  const toSavings = p.toSavings != null ? round2(p.toSavings * 26 / 12) : null;
  const spending = p.weeklySpending != null ? round2(p.weeklySpending * 52 / 12) : null;
  const bills = billsTotal(state);
  const contrib = contributionsTotal(state);
  const leftover = income != null ? round2(income - bills - contrib - (toSavings || 0) - (spending || 0)) : null;
  const weeklySavingsPlan = p.toSavings != null ? round2(p.toSavings * 26 / 52) : null;
  return { income, toSavings, spending, bills, contrib, leftover, weeklySavingsPlan };
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
export function checkinXP(c, prev, streakAfter) {
  let xp = 50;
  if (c.checking != null) xp += 10;
  if (c.spent != null) xp += 10;
  if (c.win) xp += 10;
  if (c.newDebt === false) xp += 15;
  if (prev && c.savings > prev.savings) xp += 20;
  xp += 5 * Math.min(streakAfter, 10);
  return xp;
}
export function totalXP(state) {
  const fromCheckins = state.checkins.reduce((s, c) => s + (c.xp || 0), 0);
  const fromMonthly = state.monthly.length * 40;
  const fromTasks = state.tasks.reduce((s, t) => s + 10 * (t.repeat === 'weekly' ? (t.doneWeeks || []).length : t.done ? 1 : 0), 0);
  const fromBadges = Object.keys(state.badges).length * 25;
  return fromCheckins + fromMonthly + fromTasks + fromBadges;
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
  const p = state.paycheck || {};
  const ym = monthKey(todayISO());

  if (plan.leftover != null && plan.leftover < 0) {
    out.push({ tone: 'heads-up', text: `Your plan spends ${moneyShort(-plan.leftover)} more per month than your paychecks bring in. Trimming weekly spending money or a bill would close the gap.` });
  } else if (plan.leftover != null && plan.leftover > 25) {
    out.push({ tone: 'tip', text: `Your plan leaves about ${moneyShort(plan.leftover)} a month unassigned. Sending part of it to savings would speed up your next milestone.` });
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
    L.push('I track my money weekly in an app called Month Ahead. My goal is to stop living paycheck to paycheck and build a cash buffer (first 1 month of bills saved, then 3). Here is my latest summary. Please give me encouraging, specific feedback on how this week and the trend look, and 2 or 3 concrete suggestions for the coming week.');
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
  const p = state.paycheck || {};
  if (p.takeHome != null) {
    L.push(`Paycheck plan: ${money(p.takeHome)} take-home every two weeks (about ${money(plan.income)} a month); ${money(p.toSavings ?? 0)} to savings per check; ${money(p.weeklySpending ?? 0)} a week spending money.`);
    L.push(`Unassigned after bills, savings contributions, savings and spending: ${money(plan.leftover)} a month.`);
  }
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
      L.push(`- ${dateLabel(c.date, true)}: savings ${money(c.savings)}${c.checking != null ? `, checking ${money(c.checking)}` : ''}${c.spent != null ? `, spent ${money(c.spent)}` : ''}, new debt: ${c.newDebt ? 'yes' : 'no'}${c.win ? `, win: "${c.win}"` : ''}`);
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
