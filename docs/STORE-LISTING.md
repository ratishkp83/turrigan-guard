# Store listing and privacy-practices answers (WI-P5)

Copy-ready answers for the Chrome Web Store and Microsoft Edge Add-ons submission forms, for both
editions. Written to match exactly what each extension does, so the data disclosures are accurate (the
stores reject or take down listings whose disclosures do not match behaviour).

- **Publisher:** 8plus2 Omnitech OPC Private Limited
- **Privacy policy URL (both editions):** `https://turrigan.com/guard-privacy.html`
- **Category:** Productivity
- **Support email:** support@turrigan.com

---

## Turrigan Guard (Personal, free) - PUBLIC listing

**Extension ID (self-hosted / dev):** `ehklamohfapoghhffcoemikbkcjnmipe`. The Chrome Web Store and Edge
Add-ons assign their own permanent id at item creation and reject a manifest key, so the store id will
differ; record it from the dashboard after upload.

**Single purpose:** Warn the user before personal data they typed is sent to an AI app, by checking the
message on-device and asking them to review it.

**Short description (store summary):**
> Stops personal data reaching AI apps. Scans your prompt for PII the moment you hit Send and asks you to review, on-device.

**Detailed description (suggested):**
> Turrigan Guard checks the message you are about to send to ChatGPT, Claude, Gemini, or Microsoft
> Copilot for personal data (emails, phone numbers, card numbers, national IDs, and more) the moment
> you press Send. If it finds any, it pauses and asks you to review before the message leaves your
> browser. Everything happens on your device: Guard has no network permission, no account, and no
> server. It cannot send your text anywhere, and it does nothing on any site other than the AI apps.

### Permission justifications
- **Host access to chatgpt.com, chat.openai.com, claude.ai, gemini.google.com, copilot.microsoft.com,
  m365.cloud.microsoft:** to read the message you are about to send and display the review prompt, on
  those AI apps only. The extension has no effect on any other website.

### Data use (Chrome "Privacy practices")
- **Does this item collect or use user data?** No. All processing is on-device; nothing is stored or
  transmitted. (No data categories apply.)
- **Certifications (all true):** I do not sell or transfer user data to third parties outside of the
  approved use cases; I do not use or transfer user data for purposes unrelated to the item's single
  purpose; I do not use or transfer user data to determine creditworthiness or for lending.

---

## Turrigan Guard for Enterprise (paid) - UNLISTED listing

**Extension ID (self-hosted / dev):** `lgmabljmaealpiaddahlmlohicohljdp`. This is the id for the
self-hosted `.crx` force-install source. The store assigns its own permanent id at item creation (it
rejects a manifest key), so a store-source force-install uses the store-assigned id instead; record it
from the dashboard after upload.

**Single purpose:** Warn the user before personal data is sent to an AI app, and, when the user
proceeds, record a minimised, masked audit note to the deploying organisation's own Turrigan system.

**Short description (store summary):**
> On-device PII block for AI apps, plus a tamper-evident audit trail in your Turrigan tenant when a user proceeds. Subscription-gated.

**Detailed description (suggested):**
> Turrigan Guard for Enterprise checks each message to ChatGPT, Claude, Gemini, or Microsoft Copilot
> for personal data on-device and asks the user to review before sending. For organisations, when a
> user chooses to proceed past the warning, Guard records a minimised, masked audit note to the
> organisation's own Turrigan system (never to the publisher, and never containing the message text or
> any personal data in the clear). Deployed and configured centrally by IT via managed policy;
> subscription-gated. Off-store deployment is also available for sovereign environments.

### Permission justifications
- **Host access to the AI app sites** (as Personal, above): to read the message and show the prompt on
  the AI apps only.
- **storage:** to hold the organisation's configuration, the outgoing audit queue, and the cached
  subscription status on the device.
- **alarms:** to retry audit delivery and refresh the subscription check periodically.
- **Optional host access to api.turrigan.com** (or the organisation's configured Turrigan host): to
  deliver the masked audit note and check the subscription, using an API key the organisation provides.
  Requested only for that one host.

### Data use (Chrome "Privacy practices")
Declare that the item collects the following, and describe it as minimised and masked:
- **Personally identifiable information:** a corporate user or organisation identifier (only if the
  organisation configures it) and the masked detection metadata (the types and counts of personal data
  detected, plus a masked sample of at most the last few characters). No value is transmitted in the
  clear.
- **User activity:** the fact that a user proceeded past a warning on a given AI app, with a timestamp.
- **NOT collected:** the message text, website content, or any personal data in the clear. State this
  explicitly in the form's description field.
- **Recipient:** the audit note is sent only to the **deploying organisation's own Turrigan tenant**
  (the endpoint IT configured), not to the publisher.
- **Handling:** encrypted in transit (HTTPS). Deletion and access are handled by the deploying
  organisation under its own policy and its Turrigan agreement.
- **Certifications (all true):** not sold or transferred to third parties outside the approved use;
  used only for the item's stated audit purpose; never for creditworthiness or lending.

---

## Microsoft Edge Add-ons (Partner Center) notes

The same answers apply. Edge additionally asks for: the privacy policy URL (above), a short "notice of
data collection" (use the per-edition data-use text above), and the same category. Submit Personal as
public and Enterprise as unlisted (hidden), matching the Chrome plan.

## Assets still needed (WI-P2 creative)

Screenshots (1280x800 or 640x400) showing: the review prompt catching PII on an AI app; the two-step
confirm; (Enterprise) the popup with the active subscription and a delivered audit note. Small promo
tile 440x280. The 128px icon is already in `icons/icon128.png`.
