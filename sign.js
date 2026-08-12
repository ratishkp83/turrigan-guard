/* Turrigan Guard - sign the self-hosted Enterprise .crx (controlled delivery step).
 *
 * This is NOT part of the routine build. The self-hosted force-install package is a GATED add-on we
 * hand to a specific enterprise client on request (see docs/OFFSTORE-DELIVERY.md). Run this only when
 * you are packaging a delivery. It needs the private signing key, which lives in signing/ outside the
 * repo history (gitignored) and must never be committed or shared.
 *
 * What it does: assemble the enterprise folder (build.js), pack + sign it into a .crx with Chrome using
 * the pinned enterprise key (so the id stays lgmabljmaealpiaddahlmlohicohljdp), drop the result in dist/
 * as enterprise-<version>.crx, and emit a matching updates.xml next to it. Both artifacts are gitignored
 * on purpose: they are delivery output, not source.
 *
 * Run from the repo root:  node sign.js
 * Override the Chrome path with:  CHROME="/path/to/chrome" node sign.js
 */
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY = path.resolve("signing", "enterprise.pem");
const EXT = path.resolve("enterprise");
const OUT_CRX_TMP = path.resolve("enterprise.crx"); // Chrome writes here, next to the packed folder
const EXPECTED_ID = "lgmabljmaealpiaddahlmlohicohljdp";
const DELIVERY_BASE = "https://turrigan.com/guard"; // where the client force-install policy will point

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const hit = candidates.find((c) => fs.existsSync(c));
  if (!hit) throw new Error("Chrome not found. Set CHROME=/path/to/chrome and re-run.");
  return hit;
}

// Extension id = first 128 bits of SHA-256(DER public key), each hex nibble mapped 0->a .. f->p.
function idFromKey(b64) {
  const der = Buffer.from(b64, "base64");
  const h = crypto.createHash("sha256").update(der).digest("hex").slice(0, 32);
  return h.split("").map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

if (!fs.existsSync(KEY)) {
  console.error(`Signing key missing: ${KEY}\nRestore it from your secure store (never commit it), then re-run.`);
  process.exit(1);
}

// Fail fast if the key does not derive the pinned id: signing with the wrong key would ship a NEW id and
// silently break every client's force-install list and managed policy.
const pub = crypto.createPublicKey(crypto.createPrivateKey(fs.readFileSync(KEY)));
const derB64 = pub.export({ type: "spki", format: "der" }).toString("base64");
if (idFromKey(derB64) !== EXPECTED_ID) {
  console.error(`Signing key derives id ${idFromKey(derB64)}, expected ${EXPECTED_ID}. Wrong key. Aborting.`);
  process.exit(1);
}

console.log("Signing Turrigan Guard for Enterprise (self-hosted delivery):");
require("./build"); // assemble enterprise/core + icons from the single source of truth

const VERSION = JSON.parse(fs.readFileSync(path.join("enterprise", "manifest.json"), "utf8")).version;
const chrome = findChrome();

if (fs.existsSync(OUT_CRX_TMP)) fs.unlinkSync(OUT_CRX_TMP);
try {
  execFileSync(chrome, [`--pack-extension=${EXT}`, `--pack-extension-key=${KEY}`], { stdio: "ignore" });
} catch (e) {
  // Chrome sometimes returns a non-zero code even when the pack succeeds; the file check below is the truth.
}
// Chrome may return before the file lands; wait briefly for it.
let waited = 0;
while (!fs.existsSync(OUT_CRX_TMP) && waited < 8000) { execFileSync(process.execPath, ["-e", "setTimeout(()=>{},250)"]); waited += 250; }
if (!fs.existsSync(OUT_CRX_TMP)) {
  console.error("Chrome did not produce enterprise.crx. Close other Chrome pack sessions and retry.");
  process.exit(1);
}

fs.mkdirSync("dist", { recursive: true });
const crxOut = path.resolve("dist", `enterprise-${VERSION}.crx`);
fs.renameSync(OUT_CRX_TMP, crxOut);

// Emit a matching update manifest pointing at the delivery URL for this version.
const updatesOut = path.resolve("dist", "updates.xml");
fs.writeFileSync(updatesOut,
  `<?xml version='1.0' encoding='UTF-8'?>\n` +
  `<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>\n` +
  `  <app appid='${EXPECTED_ID}'>\n` +
  `    <updatecheck codebase='${DELIVERY_BASE}/enterprise-${VERSION}.crx' version='${VERSION}' />\n` +
  `  </app>\n` +
  `</gupdate>\n`);

const kb = (fs.statSync(crxOut).size / 1024).toFixed(1);
console.log(`\n  dist/enterprise-${VERSION}.crx  (${kb} KB, id ${EXPECTED_ID})`);
console.log(`  dist/updates.xml  (codebase ${DELIVERY_BASE}/enterprise-${VERSION}.crx)`);
console.log("\nDelivery is gated. To make it available to a client, follow docs/OFFSTORE-DELIVERY.md:");
console.log("  host both files at the delivery URL, hand the client the WI-P7 force-install kit, and");
console.log("  activate their D9 Guard subscription + guard:ingest key. Nothing is published until then.");
