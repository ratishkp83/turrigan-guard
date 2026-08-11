/* Turrigan Guard - shared CORE (edition-agnostic). Composer-only pre-send interception + the two-step
 * review modal. Runs in BOTH the Personal and Enterprise extensions.
 *
 * The edition script runs BEFORE this file (content_scripts order) and sets `window.__TGEdition`:
 *   - step2()            -> {body, label, danger}  the second-prompt copy for this edition/state
 *   - onProceed(findings)-> called when the user proceeds past both prompts (Personal: no-op;
 *                           Enterprise: hand a minimised event to the background worker)
 * Core NEVER touches the network and NEVER logs. That is the edition's job, so the Personal build can
 * be shipped with no audit code and no network permission at all (provably zero-egress).
 */
(function () {
  "use strict";

  function edition() {
    return window.__TGEdition || {
      step2: function () {
        return { body: "Are you sure you want to proceed with this personal data, or was this an "
                       + "incorrect catch?", label: "Proceed anyway", danger: false };
      },
      onProceed: function () {}
    };
  }

  function detect(text) {
    try { return (window.__TurriGuard && window.__TurriGuard.detect(text)) || []; }
    catch (e) { return []; }
  }

  var bypassing = false;   // true while we programmatically resume a send (do not re-block it)
  var modalOpen = false;   // one review at a time
  var lastComposer = null; // last editable the user focused (used by the click path)

  // ---- composer helpers ----
  function editableFrom(node) {
    if (!node || node.nodeType !== 1) node = node && node.parentElement;
    if (!node) return null;
    var el = node.closest("textarea, input, [contenteditable=''], [contenteditable='true']");
    if (el) return el;
    return node.isContentEditable ? node : null;
  }

  function readText(el) {
    if (!el) return "";
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input") return el.value || "";
    return (el.innerText || el.textContent || "");
  }

  var SEND_SELECTORS = [
    '[data-testid="send-button"]', 'button[aria-label="Send message"]', 'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]', 'button[data-testid*="submit" i]', 'button[type="submit"]'
  ].join(",");

  function looksLikeSend(btn) {
    if (!btn) return false;
    try {
      if (btn.matches(SEND_SELECTORS)) return true;
      var al = (btn.getAttribute("aria-label") || "") + " " + (btn.getAttribute("data-testid") || "");
      return /\b(send|submit)\b/i.test(al);
    } catch (e) { return false; }
  }

  function findSendButton() {
    try {
      var list = document.querySelectorAll(SEND_SELECTORS);
      for (var i = 0; i < list.length; i++) {
        if (!list[i].disabled && list[i].offsetParent !== null) return list[i];
      }
      return list[0] || null;
    } catch (e) { return null; }
  }

  // Per-host PROMPT-COMPOSER selectors: guard only the app's message box, not incidental inputs on the
  // same site (search, custom-instructions, etc.). Safety net: if the known composer is not present on
  // the page at all (the app changed its markup and our selector went stale), fall back to guarding a
  // textarea / contenteditable - never a one-line <input> - so we never SILENTLY stop protecting.
  var COMPOSERS = {
    "chatgpt.com": '#prompt-textarea, form [contenteditable="true"], form textarea',
    "chat.openai.com": '#prompt-textarea, form [contenteditable="true"], form textarea',
    "claude.ai": 'div[contenteditable="true"], fieldset textarea',
    "gemini.google.com": 'rich-textarea [contenteditable="true"], .ql-editor[contenteditable="true"], rich-textarea textarea',
    "copilot.microsoft.com": 'textarea, main [contenteditable="true"]',
    "m365.cloud.microsoft": 'textarea, main [contenteditable="true"]'
  };
  function isComposer(el) {
    if (!el) return false;
    var notInput = (el.tagName || "").toLowerCase() !== "input";
    var sel = COMPOSERS[location.host] || "";
    if (!sel) return notInput;                              // unknown host: guard non-input editables
    try { if (el.matches(sel) || el.closest(sel)) return true; } catch (e) {}
    try { if (!document.querySelector(sel)) return notInput; } catch (e) {}  // selector drift -> safety net
    return false;
  }

  document.addEventListener("focusin", function (e) {
    var el = editableFrom(e.target);
    if (el) lastComposer = el;
  }, true);

  // ---- interception ----
  function guardSubmit(composer, preferredBtn) {
    if (modalOpen) return true;
    if (!isComposer(composer)) return false;   // only the app's prompt composer, not other inputs
    var text = readText(composer).trim();
    if (!text) return false;
    var findings = detect(text);
    if (!findings.length) return false; // clean -> let the app send
    modalOpen = true;
    showFlow(findings).then(function (decision) {
      modalOpen = false;
      if (decision === "proceed") {
        try { edition().onProceed(findings); } catch (e) {}
        resumeSend(composer, preferredBtn);
      }
    });
    return true;
  }

  function resumeSend(composer, preferredBtn) {
    bypassing = true;
    try {
      var btn = (preferredBtn && looksLikeSend(preferredBtn)) ? preferredBtn : findSendButton();
      if (btn) { btn.click(); } else { dispatchEnter(composer); }
    } catch (e) {}
    setTimeout(function () { bypassing = false; }, 600);
  }

  function dispatchEnter(el) {
    if (!el) return;
    try {
      el.focus();
      var opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent("keydown", opts));
      el.dispatchEvent(new KeyboardEvent("keyup", opts));
    } catch (e) {}
  }

  document.addEventListener("keydown", function (e) {
    if (bypassing) return;
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.isComposing || e.keyCode === 229) return;
    var composer = editableFrom(e.target);
    if (!composer) return;
    lastComposer = composer;
    if (guardSubmit(composer, null)) { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }
  }, true);

  document.addEventListener("click", function (e) {
    if (bypassing) return;
    var btn = e.target && e.target.closest ? e.target.closest("button, [role='button']") : null;
    if (!btn || !looksLikeSend(btn)) return;
    var composer = lastComposer && document.contains(lastComposer) ? lastComposer : editableFrom(document.activeElement);
    if (!composer) return;
    if (guardSubmit(composer, btn)) { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }
  }, true);

  // ---- modal (shadow DOM) ----
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function styleTag() {
    return "<style>" +
      ":host{all:initial}" +
      ".tg-back{position:fixed;inset:0;z-index:2147483647;background:rgba(15,17,21,.55);display:flex;align-items:center;justify-content:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}" +
      ".tg-card{width:min(440px,92vw);background:#fff;color:#0f1115;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden}" +
      ".tg-hd{display:flex;align-items:center;gap:10px;padding:16px 18px 0}" +
      ".tg-dot{width:22px;height:22px;border-radius:5px;background:#0f1115;position:relative;flex:0 0 auto}" +
      ".tg-dot:after{content:'';position:absolute;left:9px;top:4px;width:4px;height:14px;background:#ff3b30}" +
      ".tg-ttl{font-size:15px;font-weight:700;letter-spacing:.02em}" +
      ".tg-bd{padding:10px 18px 4px;font-size:14px;line-height:1.5;color:#3a3f47}" +
      ".tg-types{margin:12px 0 4px;display:flex;flex-wrap:wrap;gap:6px}" +
      ".tg-chip{font-size:12px;font-weight:600;background:#fdecea;color:#b3261e;border:1px solid #f5c6c2;border-radius:999px;padding:3px 9px}" +
      ".tg-ft{display:flex;gap:10px;justify-content:flex-end;padding:16px 18px 18px}" +
      ".tg-btn{font-size:13px;font-weight:600;border-radius:9px;padding:9px 15px;cursor:pointer;border:1px solid transparent}" +
      ".tg-secondary{background:#f2f3f5;color:#0f1115;border-color:#e2e4e8}" +
      ".tg-primary{background:#0f1115;color:#fff}" +
      ".tg-danger{background:#b3261e;color:#fff}" +
      "</style>";
  }

  function step1Html(findings) {
    var chips = findings.map(function (f) {
      return '<span class="tg-chip">' + esc(f.type) + " · " + esc(f.sample) + "</span>";
    }).join("");
    return styleTag() +
      '<div class="tg-back"><div class="tg-card">' +
      '<div class="tg-hd"><div class="tg-dot"></div><div class="tg-ttl">Possible personal data</div></div>' +
      '<div class="tg-bd">This prompt looks like it contains personal information. Review it before sending to the AI app.' +
      '<div class="tg-types">' + chips + "</div></div>" +
      '<div class="tg-ft">' +
      '<button class="tg-btn tg-secondary" id="tg-review">Review</button>' +
      '<button class="tg-btn tg-primary" id="tg-proceed">Proceed</button>' +
      "</div></div></div>";
  }

  function step2Html() {
    var s = edition().step2();
    return styleTag() +
      '<div class="tg-back"><div class="tg-card">' +
      '<div class="tg-hd"><div class="tg-dot"></div><div class="tg-ttl">Confirm before sending</div></div>' +
      '<div class="tg-bd">' + esc(s.body) + "</div>" +
      '<div class="tg-ft">' +
      '<button class="tg-btn tg-secondary" id="tg-cancel2">Cancel</button>' +
      '<button class="tg-btn ' + (s.danger ? "tg-danger" : "tg-primary") + '" id="tg-proceed2">' + esc(s.label) + "</button>" +
      "</div></div></div>";
  }

  function showFlow(findings) {
    return new Promise(function (resolve) {
      var host = document.createElement("div");
      var root = host.attachShadow({ mode: "open" });
      (document.documentElement || document.body || document).appendChild(host);
      function close(val) { try { host.remove(); } catch (e) {} resolve(val); }
      function render(html, wire) { root.innerHTML = html; wire(); }
      render(step1Html(findings), function () {
        root.getElementById("tg-review").onclick = function () { close("cancel"); };
        root.getElementById("tg-proceed").onclick = function () {
          render(step2Html(), function () {
            root.getElementById("tg-cancel2").onclick = function () { close("cancel"); };
            root.getElementById("tg-proceed2").onclick = function () { close("proceed"); };
          });
        };
      });
    });
  }
})();
