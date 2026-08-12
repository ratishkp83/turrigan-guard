/* Turrigan Guard for Enterprise - popup: subscription status, Turrigan connection config, delivery log.
 * Managed admin policy (if set) overrides the local fields and locks them. */
(function () {
  "use strict";

  var DEFAULT_BASE = "https://api.turrigan.com/v1/guard";
  var managedKeys = {};
  function el(id) { return document.getElementById(id); }

  function paintEntitlement(ent) {
    var active = false, until = null;
    if (ent && typeof ent.active === "boolean" && ent.checkedAt) {
      var age = Date.now() - Date.parse(ent.checkedAt);
      active = ent.active && !(isNaN(age) || age > 7 * 24 * 60 * 60 * 1000);
      until = ent.until || null;
    }
    var pill = el("pill");
    pill.textContent = active ? "active" : "inactive";
    pill.className = "pill " + (active ? "on" : "off");
    el("until").textContent = active ? ("Paid through " + until) : "No active subscription.";
  }

  // Surface WHY the last check did or did not succeed, so a misconfiguration is not silent.
  function paintCheck(lc) {
    var m = el("checkmsg");
    if (lc && lc.ok === false && lc.reason) { m.textContent = "Last check: " + lc.reason; m.style.color = "#b3261e"; }
    else { m.textContent = ""; }
  }

  function paintLog(log) {
    var ul = el("log"); ul.innerHTML = "";
    if (!log || !log.length) { var li = document.createElement("li"); li.className = "empty"; li.textContent = "No deliveries yet."; ul.appendChild(li); return; }
    log.slice().reverse().forEach(function (e) {
      var li = document.createElement("li");
      var ok = e.status === "delivered";
      li.innerHTML = '<div><b>' + (e.host || "") + '</b> <span class="' + (ok ? "ok" : "rt") + '">' + (e.status || "") + "</span></div>" +
        '<div class="t">' + (e.ts || "") + "</div>";
      ul.appendChild(li);
    });
  }

  function applyManagedLock() {
    var locked = Object.keys(managedKeys).length > 0;
    el("managed").style.display = locked ? "block" : "none";
    if (managedKeys.apiBaseUrl) el("url").disabled = true;
    if (managedKeys.apiKey) el("key").disabled = true;
    if (managedKeys.apiBaseUrl || managedKeys.apiKey) el("save").disabled = true;
  }

  function load() {
    var managed = {};
    var defaults = { apiBaseUrl: "", apiKey: "", tg_audit_log: [], tg_entitlement: null, tg_last_check: null };
    try {
      chrome.storage.managed.get(null, function (mg) {
        managed = mg || {};
        managedKeys = {};
        ["apiBaseUrl", "apiKey"].forEach(function (k) { if (managed[k]) managedKeys[k] = true; });
        chrome.storage.local.get(defaults, function (r) {
          // Pre-fill the address with the real default so it is not an empty box behind a grey hint
          // (the empty-box save was silently clearing the config).
          el("url").value = managedKeys.apiBaseUrl ? managed.apiBaseUrl : (r.apiBaseUrl || DEFAULT_BASE);
          el("key").value = managedKeys.apiKey ? managed.apiKey : (r.apiKey || "");
          paintEntitlement(r.tg_entitlement);
          paintCheck(r.tg_last_check);
          paintLog(r.tg_audit_log || []);
          applyManagedLock();
        });
      });
    } catch (e) {
      chrome.storage.local.get(defaults, function (r) {
        el("url").value = r.apiBaseUrl || DEFAULT_BASE; el("key").value = r.apiKey || "";
        paintEntitlement(r.tg_entitlement); paintCheck(r.tg_last_check); paintLog(r.tg_audit_log || []);
      });
    }
  }

  // Ask the worker to run a REAL entitlement check now (not just read the cache). The pill and the
  // check message repaint via storage.onChanged when the worker writes the result.
  function recheck(statusText) {
    var status = el("cfgstatus");
    if (statusText) status.textContent = statusText;
    try {
      chrome.runtime.sendMessage({ type: "tg-recheck" }, function (resp) {
        if (chrome.runtime.lastError) { return; }
        if (resp && resp.ok) status.textContent = "";
        else if (resp && resp.reason) status.textContent = "";  // the reason shows under the pill via paintCheck
      });
    } catch (e) { /* worker asleep; onChanged will still repaint when it wakes */ }
  }

  el("save").addEventListener("click", function () {
    var url = el("url").value.trim(), key = el("key").value.trim(), status = el("cfgstatus");
    // Never silently clear a working config: an empty address is a mistake to correct, not a "clear".
    if (!url) { status.textContent = "Enter the Turrigan address, e.g. " + DEFAULT_BASE; return; }
    var origin;
    try {
      var u = new URL(url);
      if (u.protocol !== "https:") { status.textContent = "Use an https:// address."; return; }
      origin = u.origin + "/*";
    } catch (e) { status.textContent = "That is not a valid address."; return; }

    // Persist the config FIRST, unconditionally. Requesting an optional host permission closes the
    // popup, which destroys this script before a permission callback can run, so gating the save on
    // that callback silently dropped the address (the "No Turrigan address is set" symptom). Save, then
    // ask for the host permission separately.
    chrome.storage.local.get({ apiKey: "" }, function (cur) {
      var finalKey = key || cur.apiKey || "";
      chrome.storage.local.set({ apiBaseUrl: url, apiKey: finalKey }, function () {
        status.textContent = "Saved. Checking...";
        // Host reach is narrowed to Turrigan (optional_host_permissions). If it is already granted, run
        // the check now; otherwise ask, and if that closes the popup the config is already saved, so a
        // later Check succeeds once access is allowed.
        function verify() { recheck("Saved. Checking..."); }
        try {
          chrome.permissions.contains({ origins: [origin] }, function (has) {
            if (chrome.runtime.lastError) { verify(); return; }
            if (has) { verify(); return; }
            chrome.permissions.request({ origins: [origin] }, function (granted) {
              if (chrome.runtime.lastError || !granted) {
                status.textContent = "Saved. Access to " + origin + " is not allowed yet: click Check and choose Allow to verify the subscription.";
                return;
              }
              verify();
            });
          });
        } catch (e) { verify(); }
      });
    });
  });

  el("check").addEventListener("click", function () { recheck("Checking..."); });

  el("clear").addEventListener("click", function () { chrome.storage.local.set({ tg_audit_log: [] }); paintLog([]); });

  chrome.storage.onChanged.addListener(function (c) {
    if (c.tg_audit_log) paintLog(c.tg_audit_log.newValue || []);
    if (c.tg_entitlement) paintEntitlement(c.tg_entitlement.newValue);
    if (c.tg_last_check) paintCheck(c.tg_last_check.newValue);
  });

  load();
})();
