# Off-store Enterprise delivery (controlled add-on)

Self-hosted force-install is an **add-on delivery option**, not a public download. It exists so an
enterprise client whose IT will not allow a store install, or who needs the extension before the store
listings clear verification, can still deploy Turrigan Guard for Enterprise. It is **off by default**:
nothing is signed, hosted, or linked on turrigan.com until we choose to package a delivery for a named
client. The Chrome Web Store and Edge Add-ons listings remain the primary channel.

This document is the control. It says when we package, how we make it available, and how we withdraw it.

## Why this is gated, not public

- A signed `.crx` cannot be installed by an ordinary user anyway. Chrome and Edge only run an off-store
  `.crx` when it is **force-installed by managed policy** on an enrolled browser. So this path is for
  managed enterprise fleets, never for consumer self-install. The Personal edition is store-only and is
  never delivered this way.
- Packaging requires the private signing key (`signing/enterprise.pem`, kept in the secure store,
  never in git) plus an explicit hosting step. Neither happens by accident, so there is no way for the
  off-store build to appear in public without a deliberate decision.
- Even if a signed `.crx` leaked, it is **inert**. Without a Guard subscription and a `guard:ingest`
  key it logs nothing and behaves like the on-device-only build (D9 invariant INV-6). There is no data
  exposure in hosting it.

## Default posture (do nothing)

Ship no `.crx`. Host nothing at the delivery URL. Add no link on the marketing site. A client is pointed
at the store listings. Only when a client explicitly asks for off-store delivery do we proceed below.

## Make it available (per client, on request)

1. **Package.** From the repo root, `node sign.js`. This assembles the enterprise folder, signs it with
   the pinned key (id stays `lgmabljmaealpiaddahlmlohicohljdp`), and writes `dist/enterprise-<version>.crx`
   plus `dist/updates.xml`. Both are gitignored delivery output, not source.
2. **Host both files** at the delivery URL `https://turrigan.com/guard/`. Keep it **unlinked** (no nav,
   no footer, not in the sitemap), so it is reachable only by the exact URL we hand the client. To host
   on the marketing site, copy the two files into `website/guard/` in the turrigan-the-sentry repo and
   deploy with the normal website `git pull` (see that repo's `docs/WEBSITE-DEPLOY.md`). A client-specific
   or access-restricted location is also fine; the only requirement is HTTPS and a stable URL.
3. **Give IT the deployment kit.** Hand the client `docs/ENTERPRISE-DEPLOYMENT.md` (WI-P7). They set the
   force-install policy value `lgmabljmaealpiaddahlmlohicohljdp;https://turrigan.com/guard/updates.xml`
   and push the managed configuration (`apiBaseUrl` + the `guard:ingest` key, optional `userId`/`orgId`).
4. **Activate the tenant (D9).** A Turrigan super admin calls
   `POST /control/tenants/{tenantId}/guard-subscription` with a paid-through date, then mints a
   `guard:ingest`-scoped API key for the tenant. That key is the `apiKey` IT puts in the managed config.
   Until this is done the extension installs but stays inactive and logs nothing.

## Update a delivered client

Bump the version in the manifest, run `node sign.js` again, and re-host the new `enterprise-<version>.crx`
plus the regenerated `updates.xml`. Managed browsers poll `updates.xml` and auto-update. The id never
changes, so the force-install list and managed policy keep working untouched.

## Withdraw it (make unavailable)

Any one of these stops delivery; do all three to fully retract:

- **Unhost.** Remove `enterprise-<version>.crx` and `updates.xml` from the delivery URL and deploy. New
  installs and update checks stop resolving.
- **Depolicy.** The client removes the id from their force-install list; the extension is uninstalled
  from managed devices at the next policy refresh.
- **Deactivate.** Lapse or revoke the tenant's Guard subscription in Turrigan. Degrade-on-lapse keeps
  on-device protection but stops all logging immediately, even before the extension is removed.

## What never changes

- The signing key stays in the secure store and is never committed or emailed.
- The stable id `lgmabljmaealpiaddahlmlohicohljdp` is fixed for every delivery and every update.
- Masked audit only. The off-store build is the same code as the store build; it sends no raw message
  text and no value in the clear, only to the client's own Turrigan tenant.
