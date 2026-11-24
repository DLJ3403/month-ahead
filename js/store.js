// Month Ahead — on-device storage. IndexedDB first, localStorage as a fallback.
// Nothing here talks to a network.

export const SCHEMA_VERSION = 2;
const DB_NAME = 'month-ahead';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'month-ahead:state';

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: { setupDone: false, lastBackupAt: null, iosPromptSeen: false },
    start: null, // { date, savings, checking, netWorth }
    incomes: [], // { id, name, amount, freq: weekly|biweekly|semimonthly|monthly|perYear, count (perYear only), reliable }
    plan: { savingsMonthly: null, weeklySpending: null },
    bills: [], // { id, name, category, amount, endMonth }
    contributions: [], // { id, name, amount }
    checkins: [], // { week, date, savings, checking, spent, extraIncome, newDebt, win, xp, xpParts, savedAt }
    monthly: [], // { month, date, retirement1, retirement2, college, homeValue, mortgage, studentLoan, carLoans, creditCards }
    tasks: [], // { id, text, repeat: 'once'|'weekly', done, doneWeeks }
    badges: {}, // id -> YYYY-MM-DD earned
    loan: { enabled: false, startRemaining: null, log: [] }, // log: { month, at }
  };
}

// Each migration takes data at version N and returns data at version N+1.
// Add one here whenever the shape changes, and bump SCHEMA_VERSION.
const MIGRATIONS = {
  // 0 → 1: data saved before versioning existed. Fill in any missing sections.
  0: (d) => ({ ...emptyState(), ...d, settings: { ...emptyState().settings, ...(d.settings || {}) }, schemaVersion: 1 }),
  // 1 → 2: one biweekly paycheck becomes a list of household income sources;
  // "to savings per paycheck" becomes a monthly savings target.
  1: (d) => {
    const p = d.paycheck || {};
    const r2 = (n) => Math.round(n * 100) / 100;
    const out = { ...d, schemaVersion: 2 };
    delete out.paycheck;
    out.incomes = Array.isArray(d.incomes) ? d.incomes : p.takeHome != null
      ? [{ id: uid(), name: 'My paycheck', amount: p.takeHome, freq: 'biweekly', count: null, reliable: true }]
      : [];
    out.plan = d.plan || { savingsMonthly: p.toSavings != null ? r2((p.toSavings * 26) / 12) : null, weeklySpending: p.weeklySpending ?? null };
    out.checkins = (d.checkins || []).map((c) => ({ extraIncome: null, ...c }));
    return out;
  },
};

export function migrate(data) {
  if (!data || typeof data !== 'object') throw new Error('That backup is not readable.');
  let d = data;
  let v = Number.isInteger(d.schemaVersion) ? d.schemaVersion : 0;
  if (v > SCHEMA_VERSION) throw new Error('This backup came from a newer version of Month Ahead. Update the app, then restore it.');
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No upgrade path from data version ${v}.`);
    d = step(d);
    v = d.schemaVersion;
  }
  // Defensive defaults for any section that might be missing.
  const base = emptyState();
  for (const k of Object.keys(base)) if (d[k] == null) d[k] = base[k];
  d.settings = { ...base.settings, ...d.settings };
  d.plan = { ...base.plan, ...d.plan };
  d.loan = { ...base.loan, ...d.loan, log: Array.isArray(d.loan?.log) ? d.loan.log : [] };
  for (const k of ['incomes', 'bills', 'contributions', 'checkins', 'monthly', 'tasks']) if (!Array.isArray(d[k])) d[k] = [];
  return d;
}

// ---------- IndexedDB ----------
let dbPromise = null;
function openDB() {
  if (!('indexedDB' in self)) return Promise.reject(new Error('no idb'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    });
  }
  return dbPromise;
}
async function idbGet() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSetKey(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.parse(JSON.stringify(value)), key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbSet(value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function idbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export let storageKind = 'indexeddb';

export async function load() {
  let raw = null;
  try { raw = await idbGet(); } catch { storageKind = 'localstorage'; }
  if (raw == null) {
    try { const s = localStorage.getItem(LS_KEY); if (s) raw = JSON.parse(s); } catch { /* unavailable */ }
  }
  if (!raw) return emptyState();
  const fromVersion = Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : 0;
  const data = migrate(raw);
  if (fromVersion !== SCHEMA_VERSION) {
    // Keep an untouched copy of the old data on the device, then save the upgraded version.
    try { if (storageKind === 'indexeddb') await idbSetKey(`state-before-v${SCHEMA_VERSION}`, raw); } catch { /* ignore */ }
    try { await save(data); } catch { /* still usable in memory */ }
  }
  return data;
}

export async function save(state) {
  const plain = JSON.parse(JSON.stringify(state));
  if (storageKind === 'indexeddb') {
    try { await idbSet(plain); try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } return; } catch { storageKind = 'localstorage'; }
  }
  localStorage.setItem(LS_KEY, JSON.stringify(plain));
}

export async function wipe() {
  try { await idbClear(); } catch { /* ignore */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

// ---------- Persistent storage ----------
export async function persistStatus() {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}
export async function requestPersist() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : null; } catch { return null; }
}

// ---------- Backups ----------
export function toBackup(state) {
  return JSON.stringify({ app: 'month-ahead', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state }, null, 2);
}
/** Accepts the backup wrapper or a bare state object. Returns migrated state. */
export function fromBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That does not look like a Month Ahead backup. It should be the text of a .json backup file.'); }
  if (parsed && parsed.app === 'month-ahead' && parsed.data) {
    const d = parsed.data;
    if (d.schemaVersion == null && parsed.schemaVersion != null) d.schemaVersion = parsed.schemaVersion;
    return migrate(d);
  }
  if (parsed && (parsed.checkins || parsed.bills || parsed.settings)) return migrate(parsed);
  throw new Error('That does not look like a Month Ahead backup.');
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
