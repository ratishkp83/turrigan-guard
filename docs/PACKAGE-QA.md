# Packaged-build QA (WI-P8)

QA of the actual store artifacts in `dist/`, split into what a script can prove without a browser
(automated, run any time) and what genuinely needs a loaded browser (a manual checklist). The charter's
definition of done for WI-P8 is: the stable id holds across a rebuild, the package carries no dev files,
the per-edition permission invariants hold, the managed-policy path works and locks the fields, and
auto-update works.

## A. Automated (browser-free): `node qa-package.js`

The harness rebuilds the packages (`build.js` + `package.js`), then reads each manifest from **inside
the zip** and checks the artifacts a client would actually install. Latest run: **ALL CHECKS PASSED**.

What it proves, per edition:

- The zip exists, is non-empty, and has `manifest.json` at the archive root (a store requirement).
- **Stable id derives from the manifest key.** The id is computed cryptographically (first 128 bits of
  SHA-256 of the DER public key, mapped a-p) and must equal the recorded id: `ehklam...` (Personal),
  `lgmabl...` (Enterprise). Because the id comes from the pinned `key`, it is stable across every
  rebuild by construction, and the harness re-derives it each run to prove it.
- **No dev files ship.** No `*.md`, `*.pem`, `tests/`, `signing/`, `docs/`, `dist/`, `build.js`,
  `package.js`, `qa-package.js`, `test-scope.js`, or the managed-policy template appear inside the zip.
- The content-script matches and `host_permissions` are exactly the six AI hosts, and all four icon
  sizes are present.
- **Personal zero-egress invariant:** no `permissions`, no `background` worker, no
  `optional_host_permissions` at all. It cannot phone home by construction.
- **Enterprise invariant:** `permissions` are exactly `storage` + `alarms`; the only optional host
  reach is `https://api.turrigan.com/*`; a background service worker is declared; `managed_schema` is
  declared and the schema file is in the package.
- **Self-hosted update manifest** (`docs/self-host/updates.xml`) has the enterprise appid, a version
  matching the package, and a codebase pointing at the matching `.crx` filename.

The assertions are non-vacuous: a planted dev file, a missing or extra host, a wrong key, or a wrong
permission set each make the corresponding check fail (verified by a negative-case pass).

## B. Manual (needs a browser): checklist

These require loading the build in a real Chromium browser, and the managed-policy items require an
enrolled/managed browser. Run before submitting to the store and before a client rollout.

### B1. Load and smoke test (both editions, Chrome and Edge)

1. Unzip `dist/personal-1.0.0.zip` (and `enterprise-1.0.0.zip`) to a folder. On `chrome://extensions`
   with Developer mode on, Load unpacked, pick the folder. Confirm it loads with **no errors** on the
   card and the id matches the table in `docs/ENTERPRISE-DEPLOYMENT.md`.
2. Open the popup. Personal renders its status; Enterprise renders the config fields and the
   subscription pill.
3. On an AI app (for example claude.ai), type `SSN 123-45-6789` into the prompt composer and press
   Send. The review modal appears; the two-step confirm works; proceeding lets the message through.
4. On a non-AI site (Gmail), type the same and send. **No modal appears** (scope boundary holds).
5. Check the service worker / page console for errors on each (Enterprise background worker included).

### B2. Enterprise managed-policy path (needs a managed browser)

6. Apply the managed configuration from `docs/enterprise-managed-policy-template.json` (see
   `docs/ENTERPRISE-DEPLOYMENT.md` for the per-platform method) with a real `apiBaseUrl` + a
   `guard:ingest` key for a test tenant that has an active Guard subscription.
7. Confirm the popup fields are **locked** (populated from policy, not user-editable) and the pill
   reads **active**.
8. Proceed past both prompts on an AI app; confirm the event lands in the tenant's Guard events log and
   the popup's Recent deliveries shows "delivered".
9. Lapse the subscription in Turrigan; confirm degrade-on-lapse (still blocks, stops logging, second
   prompt reverts to the personal copy).

### B3. Force-install and auto-update (needs a managed browser)

10. Add the enterprise id to `ExtensionInstallForcelist` (store or self-host source). Confirm it
    installs as "installed by your organisation" and is not user-removable.
11. Self-host path: publish a bumped `.crx` + `updates.xml`, confirm the managed browser auto-updates
    and the id is unchanged.

## C. Result

Automated section A: **PASS** on the current `dist/` artifacts. Section B is the owner/IT manual pass
to run in Chrome (and, once Edge publisher verification clears, in Edge).
