# Turrigan Guard - Packaging & Rollout Charter

**Status:** PROPOSED (decisions locked 2026-08-11; awaiting owner go to begin WI-P0). No packaging or
publishing action is taken until ratified. Each work item ends at a review gate, per the Turrigan
discipline.

**Context:** Both Guard editions are code-complete and the Enterprise pilot round-trip is verified in
production (tenant pilot1, org 2). This charter covers turning the extensions from developer folders
into signed, auto-updating products real clients install, plus the IT deployment kit for Enterprise.

## 1. Locked decisions

- **Enterprise distribution: BOTH.** An unlisted Chrome Web Store / Edge Add-ons listing that clients'
  IT force-install by ID, AND a self-hosted signed `.crx` plus update manifest for sovereign or
  air-gapped clients who will not allow store installs.
- **Browsers: Chrome + Edge.** Both are Chromium and take the same package (two store submissions, one
  codebase). Firefox and Safari are deferred.
- **Version control: a PRIVATE git repo** for the extension. Signing keys are stored securely OUTSIDE
  the repo and never committed.
- **Personal edition: public** on the Chrome Web Store and Edge Add-ons (the adoption funnel).
- **Publisher identity: 8plus2 Omnitech OPC Private Limited** (matches the privacy policy and the
  company behind Turrigan). Confirm at WI-P1.
- **Privacy policy: a Guard privacy page on turrigan.com** (a store-review requirement).

## 2. Goal (definition of done)

Both editions are installable as signed, auto-updating browser extensions with no folder sharing:
Personal one-click from the public stores; Enterprise force-installed and centrally configured by a
client's IT (from the unlisted store or a self-hosted `.crx`), with a deployment kit that gives IT the
extension ID, the force-install policy, and the managed configuration.

## 3. Invariants (carry the product's guarantees into the package)

- **Personal stays provably zero-egress:** no network permission, no background worker. The package
  must not add any. (The scope test already asserts this; keep it green.)
- **Enterprise reaches only `api.turrigan.com`** (narrowed host permission), unless a self-hosted
  client adds their own host and repackages.
- **Stable extension IDs** (pinned via the manifest `key`), so managed policy and force-install lists
  survive every update. Personal and Enterprise get distinct keys / IDs.
- **Signing keys never in the repo.** Masked audit only, no raw PII (unchanged from the product).
- **Honesty invariant:** store listings and data-use disclosures never claim more than ships. Personal
  collects nothing; Enterprise sends a masked audit event to the client's own Turrigan tenant.

## 4. Work items (each independently reviewable)

- **WI-P0 - Repo + key custody.** `git init` a private repo; add a `.gitignore` that excludes signing
  keys, packaged artifacts, and dev files; commit the current code + this charter. Define where the two
  edition signing keys live (secure store, not the repo). **Gate:** repo live, keys custody documented.
- **WI-P1 - Accounts + assets (owner-provided).** Chrome Web Store developer account (one-time ~$5),
  Edge Partner Center account, publisher verification, confirmed publisher entity, and the Guard brand
  icon source (or approval for me to draft one). I prepare the checklists and forms. **Gate:** accounts
  ready, assets in hand.
- **WI-P2 - Icons + store creative.** 16/32/48/128px icons wired into both manifests; store screenshots
  and promo tiles for both editions. **Gate:** review.
- **WI-P3 - Manifest hardening + stable IDs.** Add the `key` field per edition (constant IDs), bump to
  v1.0.0, store-ready names/descriptions, per-permission justifications, and strip dev files
  (`tests/`, `test-scope.js`, `*.md`) from the shipped package. **Gate:** review; IDs recorded.
- **WI-P4 - Package pipeline.** Extend `build.js` to emit clean `personal.zip` and `enterprise.zip`
  (dev files excluded), and a signed `.crx` + `updates.xml` update manifest for the self-hosted
  Enterprise path. **Gate:** review; reproducible IDs across a rebuild.
- **WI-P5 - Privacy + data-use disclosures.** The Guard privacy page on turrigan.com and the per-edition
  store data-use forms (Personal: nothing collected; Enterprise: masked audit to the client's tenant).
  **Gate:** review; no over-claim.
- **WI-P6 - Store submission + self-host publish.** Submit to Chrome Web Store and Edge Add-ons
  (Personal public, Enterprise unlisted); publish the self-hosted `.crx` + update manifest on
  turrigan.com. Handle review feedback (host permissions on AI sites and composer reading get scrutiny;
  the minimal-permission, on-device design is the defense). **Gate:** listings live / approved.
- **WI-P7 - Enterprise IT deployment kit.** The IT-facing deliverable: the stable extension ID,
  force-install snippets for Google Admin console, Microsoft Intune, and GPO (both store and self-host
  sources), the managed-policy JSON template (`apiBaseUrl` + `guard:ingest` key + optional user/org,
  keyed by the ID), verification steps, and a tie-in to the D9 activation runbook (subscription + key).
  **Gate:** review.
- **WI-P8 - Packaged-build QA.** Load the actual zips (and a self-hosted install) in Chrome and Edge;
  run the QA script against the packaged build; verify the stable ID holds across a rebuild, the
  managed-policy config path works and locks the fields, and auto-update works. **Gate:** QA pass.

## 5. Out of scope (for now)

Firefox and Safari; in-store payment (Enterprise stays contract-and-key gated, no store billing);
on-device NER for names/addresses (separate detector roadmap); any Turrigan backend change (D9 already
ships what the extension needs).

## 6. Owner inputs required (blocking, WI-P1)

- Chrome Web Store developer account + Edge Partner Center account, and publisher verification.
- Confirm the publisher entity (8plus2 Omnitech OPC Private Limited).
- The Guard brand icon source, or approval for me to draft one.
- A turrigan.com path for the privacy page and for hosting the self-hosted `.crx` + update manifest.

## 7. Sequencing

WI-P0 and WI-P1 first (P1 gates everything downstream). Then P2 / P3 / P4 are engineering I can do
without external input. P5 is the privacy page and forms. P6 needs P1 through P5. P7 needs P3 (the
stable IDs). P8 is last. Store review timing is the one item outside our control (days to a couple of
weeks).
