/* Turrigan Guard - PERSONAL edition hook.
 *
 * On-device only. Proceeding past both prompts does NOTHING beyond letting the send through: no audit,
 * no network, no storage. This file is the entire "edition" surface, and the Personal build ships with
 * no background worker and no host permission beyond the AI apps, so it CANNOT phone home. */
(function () {
  "use strict";
  window.__TGEdition = {
    step2: function () {
      return {
        body: "Are you sure you want to proceed with this personal data, or was this an incorrect catch?",
        label: "Proceed anyway",
        danger: false
      };
    },
    onProceed: function () {}   // nothing leaves the browser
  };
})();
