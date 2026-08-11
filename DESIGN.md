# Turrigan Guard - product design

Input-side companion to Turrigan: a browser extension that stops personal data from being pasted
into AI apps, at the point of submission. Turrigan's core governs AI **outputs**; this governs AI
**inputs**. Together they bracket the interaction.

## Editions

- **Personal (free):** on-device only, zero egress. Blocks a prompt that contains PII with a two-step
  review. Nothing is logged, nothing leaves the browser.
- **Enterprise (paid):** same block, plus - when a user proceeds past both prompts - a minimised
  audit event is delivered to a destination the company configures. Optionally packaged to Turrigan
  for a tamper-evident, hash-chained ledger unified with output-side governance.

## Architecture (validated by the spike)

- **Interception: composer-only, pre-send.** A capture-phase listener catches Enter / the Send button,
  reads ONLY the current composer text, and blocks that one send if it contains PII. No network
  wrapping (an earlier network-hold approach scanned background history loads and looped). Validated
  on ChatGPT, Claude, Gemini, and Microsoft Copilot.
- **Two pluggable seams behind stable contracts, so the product is Turrigan-OPTIONAL:**
  - **Detection provider:** `on-device` (default; rules) or `turrigan` (server NER, richer, when
    integrated).
  - **Audit sink:** a configurable HTTPS webhook (default). "Package to Turrigan" = point the same
    webhook at a Turrigan ingest endpoint. Config, not a rewrite.
- **Config via Chrome/Edge managed admin policy** (`storage.managed`) so IT sets mode + webhook + token
  centrally and users cannot change it. Popup-set local config is the fallback for non-managed / dev.

## Audit event contract (v1)

Minimised by design - types + MASKED samples, never raw PII:

```json
{
  "schema": "turrigan.guard.audit/v1",
  "id": "<uuid>",
  "ts": "<iso-8601>",
  "event": "pii_proceeded",
  "app": { "host": "chatgpt.com" },
  "findings": [ { "type": "email", "count": 1, "sample": "•••• .com" } ],
  "mode": "enterprise",
  "user": { "id": "<from managed policy, or null>" },
  "org": { "id": "<from managed policy, or null>" },
  "extVersion": "0.3.0"
}
```

Delivery is best-effort with a local retry buffer: if the endpoint is briefly unavailable, events
queue on-device and flush on retry, so no audit is lost. Audit delivery never blocks the user's send
(the block decision is the modal, not the logging).

## Detection (on-device tier)

email, US SSN, Emirates ID, phone, Luhn-valid card, IBAN (mod-97), and context-anchored date of
birth / passport / Aadhaar. Precision-first: the soft types require a cue word nearby. Names,
addresses, and free-form PII are the server-NER upgrade (see sidelined items).

## Status

- [x] Interception approach validated across the four target apps.
- [x] On-device detector (structured + context-anchored types).
- [x] Two-step review UI.
- [x] Enterprise audit sink (retry buffer + managed-policy config).
- [x] **Two separate extensions: `core/` shared, `personal/` (zero-egress) and `enterprise/` builds.**
- [x] **Enterprise connected to Turrigan: audit to `POST /v1/guard/events` via `X-API-Key`; entitlement
      poll of `GET /v1/guard/entitlement` with a 7-day offline grace and degrade-on-lapse.**
- [ ] Store packaging, icons, enterprise force-install (Chrome/Edge admin policy).
- [ ] On-device NER for names/addresses.

## Sidelined - future add-ons (revisit later, not in the current build)

- **LAN / air-gapped deployment.** The webhook is just "POST to a configured URL", so an
  egress-restricted enterprise points it at an INTERNAL collector or an on-prem Turrigan instance and
  the audit never leaves the LAN; detection stays on-device (or an internal Turrigan). Also lets us
  guard **internal / self-hosted LLM** web UIs by adding their host to the match patterns. Captured
  here as a deliberate future add-on; the current build assumes an internet-or-intranet-reachable
  webhook URL without special air-gap handling.
- **Turrigan integration (the upsell):** server-NER detection provider (richer PII incl.
  names/addresses) and the tamper-evident hash-chained ledger. Do NOT rebuild the chain in the
  extension.
- **More apps / browsers:** Canva (a design tool, different composer model), Firefox/Safari.
- **Detection depth:** on-device NER (WASM) for the free tier; more identifier types.
