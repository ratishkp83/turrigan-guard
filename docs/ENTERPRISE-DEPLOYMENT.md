# Turrigan Guard for Enterprise - IT deployment kit (WI-P7)

This is the deliverable your client's IT team uses to roll Turrigan Guard for Enterprise out to a
managed fleet. It gives them the stable extension id, the force-install policy for each management
platform, the managed configuration that points the extension at the tenant's Turrigan Guard API, the
verification steps, and how it ties into activating the tenant on the Turrigan side.

Everything here assumes a browser that IT centrally manages (Chrome or Edge enrolled in Google Admin
console, Microsoft Intune, or Windows Group Policy). A user cannot self install this edition, and that
is deliberate. The Personal edition is the one users install themselves from the store.

## 0. Before you deploy: activate the tenant in Turrigan (D9)

The extension is inert until the tenant has a Guard subscription and an ingest key. Do this first, on
the Turrigan side, or every device will install the extension but the subscription pill will read
inactive and nothing will be logged.

1. Give the tenant a Guard subscription. A Turrigan super admin calls
   `POST /control/tenants/{tenantId}/guard-subscription` with a paid-through date. This turns the
   tenant's `GET /v1/guard/entitlement` response to active.
2. Mint an ingest key. Create a Turrigan API key for the tenant scoped to `guard:ingest`. This is the
   value that goes in `apiKey` below. Treat it as a secret: it authorises writing audit events to the
   tenant, nothing else.
3. Note the tenant's API base. For the shared cloud it is `https://api.turrigan.com/v1/guard`. A
   sovereign or self-hosted Turrigan uses its own host, and that host must also be added to the
   extension's reach (see the self-hosted note in section 5).

Keep the ingest key out of email and chat. Hand it to IT through the client's secret manager or the
managed-policy channel directly.

## 1. Stable extension ids (never change)

The manifest `key` field pins a constant id per edition across every update, so force-install lists and
managed policy keep working after each release. These ids are cryptographically derived from the packaged
public key and are verified by the packaged-build QA (`qa-package.js`), not typed by hand.

| Edition | Extension id | Store visibility |
|---|---|---|
| Personal (free) | `ehklamohfapoghhffcoemikbkcjnmipe` | Public |
| Enterprise (paid) | `lgmabljmaealpiaddahlmlohicohljdp` | Unlisted (force-install only) |

Enterprise deployment uses the enterprise id `lgmabljmaealpiaddahlmlohicohljdp` throughout.

## 2. Choose an install source

There are two supported sources. Pick one per fleet; the managed configuration in section 4 is the same
for both.

- **A. Chrome Web Store, unlisted.** IT force-installs by id from the store. Auto-update is handled by
  the store. This is the default for clients who allow store installs. Update URL:
  `https://clients2.google.com/service/update2/crx`.
- **B. Self-hosted signed `.crx`.** For sovereign or air-gapped clients who will not allow store
  installs, IT force-installs from a `.crx` and `updates.xml` that you host over HTTPS. See
  `docs/SELF-HOST.md` for building and signing the `.crx`. Update URL is your manifest, for example
  `https://turrigan.com/guard/updates.xml`.

The force-install policy value is always `<extension-id>;<update-url>`. So:

- Store source: `lgmabljmaealpiaddahlmlohicohljdp;https://clients2.google.com/service/update2/crx`
- Self-host source: `lgmabljmaealpiaddahlmlohicohljdp;https://turrigan.com/guard/updates.xml`

## 3. Force-install by platform

### 3a. Google Admin console (managed Chrome)

1. Sign in to the Google Admin console, go to Devices, then Chrome, then Apps & extensions, then Users
   & browsers. Select the org unit to target.
2. Add the extension. For the store source, add by id `lgmabljmaealpiaddahlmlohicohljdp`. For the
   self-host source, use "Add Chrome app or extension by URL" and give the `updates.xml` URL.
3. Set the installation policy to **Force install**. Optionally turn on "pin to toolbar".
4. In the same extension's **Policy for extensions** box, paste the managed configuration JSON from
   section 4. Save.

### 3b. Microsoft Intune (managed Chrome or Edge)

Intune has no native field for the Chrome managed configuration, so push both the force-install list and
the managed configuration as registry values through a Custom (OMA-URI) configuration profile, or use
the Chrome and Edge ADMX templates if you have them ingested.

Force-install (Chrome), OMA-URI custom setting:
- Name: Guard force-install
- OMA-URI: `./Device/Vendor/MSFT/Policy/Config/Chrome~Policy~googlechrome~Extensions/ExtensionInstallForcelist/1`
- Data type: String
- Value: `lgmabljmaealpiaddahlmlohicohljdp;https://clients2.google.com/service/update2/crx`

Managed configuration (Chrome), one OMA-URI per key, mirroring the registry path in section 3c. For
example:
- OMA-URI: `./Device/Vendor/MSFT/Registry/HKLM/Software/Policies/Google/Chrome/3rdparty/extensions/lgmabljmaealpiaddahlmlohicohljdp/policy/apiBaseUrl`
- Data type: String, Value: `https://api.turrigan.com/v1/guard`
- Repeat for `apiKey`, and optionally `userId` and `orgId`.

For managed Edge, use the Edge policy namespace: replace `googlechrome`/`Google\Chrome` with the Edge
equivalents (`microsoft_edge` and `Software\Policies\Microsoft\Edge`).

### 3c. Windows Group Policy / registry (Chrome and Edge)

Force-install list (Chrome):
```
HKLM\Software\Policies\Google\Chrome\ExtensionInstallForcelist
  1 = lgmabljmaealpiaddahlmlohicohljdp;https://clients2.google.com/service/update2/crx
```
For the self-host source, use the `updates.xml` URL instead. For Edge, use
`HKLM\Software\Policies\Microsoft\Edge\ExtensionInstallForcelist`.

Managed configuration (Chrome), string values under the extension's 3rdparty policy path:
```
HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\lgmabljmaealpiaddahlmlohicohljdp\policy
  apiBaseUrl = https://api.turrigan.com/v1/guard
  apiKey     = <the guard:ingest key you minted>
  userId     = <optional>
  orgId      = <optional>
```
For Edge, the same values live under
`HKLM\Software\Policies\Microsoft\Edge\3rdparty\extensions\lgmabljmaealpiaddahlmlohicohljdp\policy`.

## 4. Managed configuration values

These keys match `enterprise/schema/managed_schema.json` exactly. A ready-to-edit copy is at
`docs/enterprise-managed-policy-template.json`. Managed values override anything a user sets in the
popup, so IT owns them and users cannot change where audit goes.

| Key | Required | Meaning |
|---|---|---|
| `apiBaseUrl` | Yes | Base URL of the tenant's Guard API. The extension posts to `{apiBaseUrl}/events` and polls `{apiBaseUrl}/entitlement`. Cloud value: `https://api.turrigan.com/v1/guard`. |
| `apiKey` | Yes | The tenant's `guard:ingest` scoped Turrigan API key, sent as the `X-API-Key` header. |
| `userId` | No | A corporate user identifier (for example UPN) to stamp on audit events. Omit to leave events user-anonymous. |
| `orgId` | No | An organisation or tenant identifier to stamp on audit events. |

The Google Admin console "Policy for extensions" box wants a single JSON object of these keys and values
(without the `$comment` line). The registry and Intune paths above set the same keys as individual
string values.

## 5. Notes on reach and privacy

- **The extension only reaches the tenant's Turrigan host.** The enterprise package requests one
  optional host permission, `https://api.turrigan.com/*`, purely to deliver the masked audit note and
  check the subscription. It touches no other network destination. A self-hosted Turrigan on a
  different host must add that host to the manifest and repackage; the stock store build reaches only
  `api.turrigan.com`.
- **What an audit event contains.** When a user proceeds past both prompts on an AI app, the extension
  sends the detection types and counts, a masked sample of at most the last few characters, a
  timestamp, the AI host, and the optional `userId`/`orgId`. It never sends the message text, and no
  detected value is transmitted in the clear: the sample is masked down to at most the last few
  characters. It never sends anything to the publisher. The recipient is only the tenant's own Turrigan.
- **Degrade on lapse.** If the subscription is inactive or the entitlement check has been unreachable
  beyond the offline grace, the extension keeps blocking PII on-device but stops logging, and the
  second prompt reverts to the plain personal copy. Users stay protected even if billing lapses.

## 6. Edge

Edge is Chromium and takes the same package and the same managed configuration under the Edge policy
namespace shown above. The self-hosted `.crx` path works on managed Edge today. The unlisted Edge
Add-ons store listing is deferred until Edge publisher verification completes, so for Edge fleets use
the self-hosted source (section 2B) for now.

## 7. Verify the rollout

On a managed device after policy has applied (allow a few minutes, or run `gpupdate /force` on Windows):

1. Open `chrome://policy` (or `edge://policy`) and confirm `ExtensionInstallForcelist` contains the
   enterprise id, and that the 3rdparty policy values (`apiBaseUrl`, `apiKey`) are present.
2. Open `chrome://extensions` (or `edge://extensions`). Turrigan Guard for Enterprise shows as
   **installed by your organisation**, is not removable by the user, and its id matches
   `lgmabljmaealpiaddahlmlohicohljdp`.
3. Confirm site access lists only the six AI-app hosts.
4. Open the extension popup. The subscription pill should read **active** once `apiBaseUrl` + `apiKey`
   are applied. If it reads inactive, re-check the D9 activation in section 0 and the `apiKey` value.
5. End to end: on an AI app, type a value such as `SSN 123-45-6789`, proceed past both prompts. The
   event should appear in the tenant's Guard events log, and the popup's Recent deliveries shows
   "delivered".

## 8. Update, roll back, remove

- **Update.** Store source updates automatically. Self-host: publish a new `.crx` and bump both the
  package version and `updates.xml`; managed browsers poll and auto-update. The id never changes.
- **Remove.** Delete the id from the force-install list (and the 3rdparty policy values). The extension
  is removed from managed devices at the next policy refresh.
- **Suspend logging without uninstalling.** Let the tenant's subscription lapse or revoke it in
  Turrigan. Degrade-on-lapse keeps on-device protection but stops all logging.
