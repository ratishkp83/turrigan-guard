# Chrome Web Store submission runbook (WI-P1 / WI-P6, Chrome scope)

A field-by-field walkthrough for submitting both editions to the Chrome Web Store, using the copy in
`docs/STORE-LISTING.md` verbatim. Follow it top to bottom per edition. Edge Add-ons is deferred until
Edge publisher verification clears (see the end); nothing here blocks on Edge.

The developer account exists. What is left is one console session per edition: upload the zip, paste the
listing copy, attach screenshots, fill the privacy form, and submit. The zips are already built and QA
passed (`node qa-package.js`).

## Artifacts to upload

| Edition | Upload this | Visibility |
|---|---|---|
| Personal (free) | `dist/personal-1.0.1.zip` | **Public** |
| Enterprise (paid) | `dist/enterprise-1.0.1.zip` | **Unlisted** |

Do not rename the zips. If you rebuild, re-run `node qa-package.js` and upload the fresh zip.

## One-time account items (WI-P1)

- Confirm the publisher entity shown on the account is **8plus2 Omnitech OPC Private Limited** (matches
  the privacy policy and the store-listing copy).
- Group both items under the same publisher.
- Support email: `support@turrigan.com`.
- The privacy policy URL both listings reference is `https://turrigan.com/guard-privacy.html`. **This
  page must be live before you submit** (the draft is in the turrigan-the-sentry repo at
  `website/guard-privacy.html`, untracked; deploying the website is your call). The store rejects a
  listing whose privacy URL 404s.

## Screenshots and creative (the one owner-action asset)

The store requires at least one screenshot at 1280x800 or 640x400 per listing. These need the loaded
extension on a real page, so they are captured by hand (do the B1 load in `docs/PACKAGE-QA.md` first),
not generated here. Shot list:

- **Both editions, shot 1:** the review modal catching PII on an AI app. Type `SSN 123-45-6789` (or an
  email) into the composer on claude.ai or chatgpt.com, trigger Send, and capture the first prompt.
- **Both editions, shot 2:** the two-step confirm (the second prompt).
- **Enterprise, shot 3:** the popup showing the subscription pill **active** and a delivered audit note
  under Recent deliveries.
- Optional small promo tile 440x280. The 128px icon is already at `icons/icon128.png`.

Keep the screenshots free of real personal data; use the synthetic test values above.

## Per-edition dashboard fields

Open the Chrome Web Store developer dashboard, add a new item, upload the edition's zip, then fill the
Store listing, Privacy, and Distribution tabs. All copy below is in `docs/STORE-LISTING.md`; paste it
exactly so the disclosures match behaviour.

### Personal (free) - PUBLIC

**Store listing tab**
- Name: `Turrigan Guard`
- Summary (short description): the one-line summary from STORE-LISTING.md ("Stops personal data
  reaching AI apps...").
- Description (detailed): the Personal detailed description from STORE-LISTING.md.
- Category: `Privacy & Security`.
- Language: English.
- Screenshots: shots 1 and 2 above. Icon: `icons/icon128.png`.

**Privacy tab**
- Single purpose: the Personal single-purpose sentence from STORE-LISTING.md.
- Permission justifications: paste the host-access justification from STORE-LISTING.md (the six AI
  hosts, read the composer and show the prompt, no effect elsewhere). Personal declares no other
  permissions, so there is nothing else to justify.
- Data usage / Privacy practices: **Does this item collect user data? No.** No data categories apply.
  Tick all three certifications (no sale/transfer, only for the single purpose, not for
  creditworthiness). This matches the zero-egress build QA proved.
- Privacy policy URL: `https://turrigan.com/guard-privacy.html`.

**Distribution tab**
- Visibility: **Public**. Regions: all (or per your preference).

Submit for review.

### Enterprise (paid) - UNLISTED

**Store listing tab**
- Name: `Turrigan Guard for Enterprise`
- Summary: the Enterprise short description from STORE-LISTING.md.
- Description: the Enterprise detailed description from STORE-LISTING.md.
- Category: `Privacy & Security`. Screenshots: shots 1, 2, and 3.

**Privacy tab**
- Single purpose: the Enterprise single-purpose sentence from STORE-LISTING.md.
- Permission justifications: paste the Enterprise justifications from STORE-LISTING.md, one per item:
  host access to the six AI apps; `storage` (config, audit queue, cached subscription); `alarms` (retry
  delivery, refresh the subscription check); optional host access to `api.turrigan.com` (deliver the
  masked audit note and check the subscription, that one host only).
- Data usage / Privacy practices: **Yes, it collects data.** Declare, using the Enterprise data-use
  text from STORE-LISTING.md: personally identifiable information (an optional corporate user/org
  identifier and masked detection metadata), and user activity (the fact that a user proceeded, with a
  timestamp). In the description field state explicitly that the message text and personal data in the
  clear are **not** collected, and that the recipient is the deploying organisation's own Turrigan
  tenant, not the publisher. Encrypted in transit. Tick the three certifications.
- Privacy policy URL: `https://turrigan.com/guard-privacy.html`.

**Distribution tab**
- Visibility: **Unlisted** (installable by direct link and by managed force-install, not shown in
  search). This is what the IT deployment kit force-installs by id.

Submit for review.

## Likely review scrutiny and the defense

The host permissions on AI sites and reading the composer draw review attention. The defense is the
design, stated plainly in the justifications: the extension runs only on the six named AI hosts, reads
only the prompt composer to show a local review prompt, and (Personal) has no network permission at all.
Keep the justification text specific and matching the manifest; do not over-claim. If review asks for a
demo video, record the B1 smoke test.

## Timeline and after approval

Review typically takes from a day to a couple of weeks and is outside our control. After Personal is
approved, its public listing URL is the adoption funnel. The store assigns each item its own permanent
id (it is NOT the self-hosted `ehklam...`/`lgmabl...` id, and the store rejects a manifest key). After
each item is created, capture the store-assigned id from the dashboard and record it in
`docs/ENTERPRISE-DEPLOYMENT.md` section 1. For enterprise, that store id is what a store-source
force-install references; the self-hosted `.crx` source keeps using `lgmabljmaealpiaddahlmlohicohljdp`.

## Edge (deferred)

Edge Add-ons submission is on hold pending Edge publisher verification. The same zips and the same
STORE-LISTING.md answers apply when it clears (Personal public, Enterprise unlisted). Until then,
Enterprise clients on Edge use the self-hosted `.crx` path (see `docs/SELF-HOST.md` and section 6 of
`docs/ENTERPRISE-DEPLOYMENT.md`), which does not depend on the Edge store.
