/* Turrigan Guard - ENTERPRISE edition hook.
 *
 * Same on-device block as Personal, plus: when the user proceeds past both prompts AND the tenant's
 * Guard subscription is active, hand a MINIMISED event (types + masked samples, never raw PII) to the
 * background worker, which posts it to the tenant's Turrigan ingest with the guard:ingest API key.
 *
 * Degrade-on-lapse: entitlement is owned by the background worker (it polls GET /entitlement, caches
 * it, and applies the offline grace). If the subscription is not active this hook logs NOTHING and the
 * second prompt shows the plain Personal copy, so users stay protected but nothing is recorded. */
(function () {
  "use strict";

  var entitled = false;  // updated from the background worker's cached entitlement

  function refreshEntitlement() {
    try {
      chrome.runtime.sendMessage({ type: "tg-entitlement" }, function (r) {
        if (r && typeof r.active === "boolean") entitled = r.active;
      });
    } catch (e) {}
  }
  refreshEntitlement();

  function buildEvent(findings) {
    return {
      schema: "turrigan.guard.audit/v1",
      id: (self.crypto && crypto.randomUUID) ? crypto.randomUUID()
                                             : (String(Date.now()) + "-" + Math.round(Math.random() * 1e9)),
      ts: new Date().toISOString(),
      event: "pii_proceeded",
      app: { host: location.host },
      findings: findings.map(function (f) { return { type: f.type, count: f.count, sample: f.sample }; }),
      mode: "enterprise",
      extVersion: (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || ""
    };
  }

  window.__TGEdition = {
    step2: function () {
      return entitled
        ? { body: "If you proceed, this will be recorded in your organisation's audit log for review.",
            label: "Proceed and log", danger: true }
        : { body: "Are you sure you want to proceed with this personal data, or was this an incorrect catch?",
            label: "Proceed anyway", danger: false };
    },
    onProceed: function (findings) {
      refreshEntitlement();               // keep the cached flag fresh for the next prompt
      if (!entitled) return;              // degrade-on-lapse: no logging when not entitled
      try { chrome.runtime.sendMessage({ type: "tg-audit", event: buildEvent(findings) }); } catch (e) {}
    }
  };
})();
