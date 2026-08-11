/* Turrigan Guard - ENTERPRISE background worker.
 *
 * Two jobs, both against the tenant's Turrigan instance, authenticated with the least-privilege
 * `guard:ingest` API key (X-API-Key):
 *   1. Entitlement: poll GET {apiBaseUrl}/entitlement on startup + daily, cache it, and apply a
 *      7-day OFFLINE GRACE so a transient outage does not disable a paid tenant. The edition asks us
 *      ("tg-entitlement") whether the paid capability is active; on lapse it degrades to on-device
 *      blocking (no logging).
 *   2. Audit: deliver each minimised event ("tg-audit") to POST {apiBaseUrl}/events, with a local
 *      retry buffer, only while entitled. Delivery never blocks the user's send.
 *
 * Config precedence: managed admin policy (chrome.storage.managed: apiBaseUrl, apiKey, userId, orgId)
 * OVERRIDES local. "Package to Turrigan" is just pointing apiBaseUrl at https://api.turrigan.com/v1/guard.
 */
const QUEUE_KEY = "tg_audit_queue";
const LOG_KEY = "tg_audit_log";
const ENT_KEY = "tg_entitlement";
const LASTCHECK_KEY = "tg_last_check";
const QUEUE_MAX = 500;
const LOG_MAX = 50;
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;   // 7-day offline grace (charter section 9)
const FLUSH_ALARM = "tg-audit-flush";
const ENT_ALARM = "tg-entitlement";

async function getConfig() {
  const local = await chrome.storage.local.get({ apiBaseUrl: "", apiKey: "", userId: "", orgId: "" });
  let managed = {};
  try { managed = (await chrome.storage.managed.get(null)) || {}; } catch (e) { managed = {}; }
  return Object.assign({}, local, Object.fromEntries(
    Object.entries(managed).filter(function (kv) { return kv[1] !== undefined && kv[1] !== null && kv[1] !== ""; })
  ));
}

function _base(cfg) { return String(cfg.apiBaseUrl || "").replace(/\/+$/, ""); }

// ---- entitlement ----
function _effectiveActive(ent) {
  if (!ent || typeof ent.active !== "boolean" || !ent.checkedAt) return false;
  const age = Date.now() - Date.parse(ent.checkedAt);
  if (isNaN(age) || age > GRACE_MS) return false;   // beyond the offline grace -> treat as lapsed
  return ent.active;
}

async function _recordCheck(ok, reason) {
  // Record the outcome of the last check so the popup can SHOW why it did / did not succeed, instead
  // of failing silently. This is diagnostics only; it never changes the cached entitlement (grace).
  try { await chrome.storage.local.set({ [LASTCHECK_KEY]: { at: new Date().toISOString(), ok: ok, reason: reason || null } }); } catch (e) {}
  return { ok: ok, reason: reason || null };
}

async function checkEntitlement() {
  const cfg = await getConfig();
  if (!_base(cfg)) return _recordCheck(false, "No Turrigan address is set.");
  if (!cfg.apiKey) return _recordCheck(false, "No API key is set.");
  try {
    const resp = await fetch(_base(cfg) + "/entitlement", { headers: { "x-api-key": cfg.apiKey } });
    if (!resp.ok) {
      // Keep the cached value (grace window covers a transient failure), but report why.
      const reason = resp.status === 401 ? "API key was rejected (401). Check the key."
        : "Server returned HTTP " + resp.status + ".";
      return _recordCheck(false, reason);
    }
    const data = await resp.json();
    await chrome.storage.local.set({ [ENT_KEY]: {
      active: !!data.active, until: data.until || null, checkedAt: new Date().toISOString()
    } });
    flush();   // entitlement may have just turned on; try any buffered events
    return _recordCheck(true, null);
  } catch (e) {
    // Network error or missing host permission. Keep cached (grace) but say so plainly.
    return _recordCheck(false, "Cannot reach " + _base(cfg) + " (check the address, and that access to api.turrigan.com is allowed).");
  }
}

// ---- audit ----
async function getQueue() { return (await chrome.storage.local.get({ [QUEUE_KEY]: [] }))[QUEUE_KEY]; }
async function setQueue(q) { await chrome.storage.local.set({ [QUEUE_KEY]: q.slice(-QUEUE_MAX) }); }

async function logDelivery(entry) {
  const cur = (await chrome.storage.local.get({ [LOG_KEY]: [] }))[LOG_KEY];
  cur.push(entry);
  await chrome.storage.local.set({ [LOG_KEY]: cur.slice(-LOG_MAX) });
}

async function enqueue(event) {
  const q = await getQueue();
  q.push(event);
  await setQueue(q);
  flush();
}

async function deliver(event, cfg) {
  const headers = { "content-type": "application/json", "x-api-key": cfg.apiKey };
  const body = Object.assign({}, event, { user: { id: cfg.userId || null }, org: { id: cfg.orgId || null } });
  const resp = await fetch(_base(cfg) + "/events", { method: "POST", headers: headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
}

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const cfg = await getConfig();
    const q = await getQueue();
    if (!q.length) return;
    const ent = (await chrome.storage.local.get({ [ENT_KEY]: null }))[ENT_KEY];
    if (!_base(cfg) || !cfg.apiKey || !_effectiveActive(ent)) { scheduleRetry(); return; }  // degrade: hold
    let remaining = [];
    for (let i = 0; i < q.length; i++) {
      try {
        await deliver(q[i], cfg);
        await logDelivery({ ts: new Date().toISOString(), host: (q[i].app || {}).host, status: "delivered" });
      } catch (e) {
        remaining = q.slice(i);
        await logDelivery({ ts: new Date().toISOString(), host: (q[i].app || {}).host, status: "retry: " + String(e.message || e) });
        break;
      }
    }
    await setQueue(remaining);
    if (remaining.length) scheduleRetry();
  } finally {
    flushing = false;
  }
}

function scheduleRetry() { try { chrome.alarms.create(FLUSH_ALARM, { delayInMinutes: 1 }); } catch (e) {} }

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === "tg-audit" && msg.event) { enqueue(msg.event); try { sendResponse({ ok: true }); } catch (e) {} return true; }
  if (msg && msg.type === "tg-entitlement") {
    chrome.storage.local.get({ [ENT_KEY]: null }).then(function (r) {
      try { sendResponse({ active: _effectiveActive(r[ENT_KEY]) }); } catch (e) {}
    });
    return true;
  }
  if (msg && msg.type === "tg-recheck") {
    // Run a REAL entitlement check now (Save / "Check now" use this), then report the outcome. The
    // popup also repaints from storage.onChanged when checkEntitlement writes the result.
    checkEntitlement().then(function (res) {
      chrome.storage.local.get({ [ENT_KEY]: null }).then(function (r) {
        try { sendResponse({ ok: res.ok, reason: res.reason || null, active: _effectiveActive(r[ENT_KEY]) }); } catch (e) {}
      });
    });
    return true;
  }
  return false;
});

chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name === FLUSH_ALARM) flush();
  if (a.name === ENT_ALARM) checkEntitlement();
});
function _boot() {
  try { chrome.alarms.create(ENT_ALARM, { periodInMinutes: 720 }); } catch (e) {}  // daily-ish entitlement refresh
  checkEntitlement();
  flush();
}
chrome.runtime.onStartup.addListener(_boot);
chrome.runtime.onInstalled.addListener(_boot);
