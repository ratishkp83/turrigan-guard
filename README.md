# Turrigan Guard

Two browser extensions that stop personal data going into AI apps (ChatGPT, Claude, Gemini, Microsoft
Copilot). They check the current prompt for PII the moment you hit Enter/Send and ask you to review,
entirely on-device. Built from one shared core so the two editions never diverge.

- **Personal (`personal/`)** - free, **on-device only**. No audit, no background worker, no network
  permission at all. It cannot phone home by construction.
- **Enterprise (`enterprise/`)** - paid. Same block, plus a tamper-evident audit trail in your
  Turrigan tenant when a user proceeds past both prompts. Subscription-gated; force-installed and
  configured centrally by IT.

## Layout

```
core/                shared source of truth (detector + composer interception + modal)
  detector.js        on-device PII detector (regex + context-anchored DOB/passport/Aadhaar; masked output)
  guard-core.js      capture-phase Enter/Send interception + two-step review modal (edition-agnostic)
personal/            the free extension (loadable)
  manifest.json  edition.js  popup.html  core/ (copied by build.js)
enterprise/          the paid extension (loadable)
  manifest.json  edition.js  background.js  popup.html  popup.js  schema/managed_schema.json  core/ (copied)
build.js             copies core/ into personal/core and enterprise/core (run after editing core/)
```

`edition.js` is the only behavioural difference: it sets `window.__TGEdition` with the second-prompt
copy and an `onProceed(findings)` hook. Personal's is a no-op; Enterprise's hands a minimised event to
its background worker.

## Build + load

```
node build.js
```

Then in `chrome://extensions` (or `edge://extensions`) with Developer mode on, **Load unpacked** and
pick either `personal/` or `enterprise/`. Reload the AI tab after loading. Re-run `node build.js`
whenever you change anything under `core/`.

## Enterprise: connecting to Turrigan

The enterprise edition talks to the D9 Guard API in your Turrigan tenant:
- Audit: `POST {apiBaseUrl}/events` with the `guard:ingest` API key as `X-API-Key`.
- Entitlement: `GET {apiBaseUrl}/entitlement`, polled on startup and daily, cached with a **7-day
  offline grace** so a transient outage does not disable a paid tenant.

Configure via Chrome/Edge **managed admin policy** (`schema/managed_schema.json`), which IT owns and
users cannot change: `apiBaseUrl` (e.g. `https://api.turrigan.com/v1/guard`), `apiKey`, optional
`userId`/`orgId`. For local testing, the popup lets you set `apiBaseUrl` + `apiKey` and shows the
subscription status and recent deliveries.

**Degrade-on-lapse.** When the subscription is inactive (expired, suspended, or the entitlement check
has been unreachable beyond the grace window) the enterprise extension **keeps blocking on-device but
stops logging**, and the second prompt shows the plain personal copy. Users stay protected; nothing is
recorded until the subscription is renewed.

## Testing (enterprise end to end)

1. In Turrigan: give the tenant a Guard subscription (control plane) and mint a `guard:ingest` key.
2. `node build.js`, load `enterprise/`, reload an AI tab.
3. Popup: set `apiBaseUrl` (your `.../v1/guard`) + the key, Save, grant the permission prompt. The
   subscription pill should read **active**.
4. Send `SSN 123-45-6789`, proceed past both prompts. The event should appear in your tenant's
   guard-events log, and the popup's **Recent deliveries** shows "delivered".
5. Expire/clear the subscription in Turrigan: the pill flips to **inactive**, the second prompt
   reverts to the personal copy, and proceeding records nothing.

## Scope check (confirm it does NOT touch non-AI sites)

The guard is injected only on the six AI-app hosts (`content_scripts.matches`), so it never runs
elsewhere. An automated pattern test proves the boundary (run any time):

```
node test-scope.js
```

It asserts the content-script matches accept the six AI apps and reject Gmail, Outlook, Google, Google
Docs, banking, WhatsApp, our own `api.turrigan.com`, look-alike domains, and http, for both editions;
that the enterprise host reach is narrowed to `api.turrigan.com` (no `https://*/*`); and that Personal
declares no permissions/background at all.

Also confirm empirically after loading either edition:
1. Open Gmail/Outlook, type PII (e.g. `SSN 123-45-6789`) into a message box, send. **No modal appears.**
2. On `chrome://extensions`, the extension's site access lists only the six AI hosts.

Production hardening (done): within an allowed AI-app page the guard now targets that app's **prompt
composer** via per-host selectors, not every input, so an incidental field (search, custom
instructions) is not intercepted. If the app's composer markup drifts so the selector matches nothing,
it safely falls back to guarding large text areas (never a one-line input) rather than silently
stopping. Enterprise network reach is narrowed to `https://api.turrigan.com/*`; a self-hosted Turrigan
adds its host to the manifest/policy and repackages.

## Detection (on-device)

email, US SSN, Emirates ID, phone, Luhn-valid card, IBAN (mod-97), and context-anchored date of birth
/ passport / Aadhaar. Precision-first: the soft types need a cue word nearby, so an ordinary date or
number does not trigger. Names, addresses, and free-form PII are the server-NER upgrade (Turrigan).

## Not in the spike yet

Store packaging + icons; enterprise force-install policy; on-device NER for names/addresses; Canva and
Firefox/Safari. See `DESIGN.md`.
