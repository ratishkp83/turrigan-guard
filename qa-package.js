/* Turrigan Guard - packaged-build QA (WI-P8).
 *
 * Verifies the ACTUAL store artifacts in dist/ (not the source folders), so what QA checks is what a
 * client would install. It rebuilds the packages first, reads each manifest from inside the zip,
 * derives the extension id cryptographically from the manifest key, and asserts every packaging
 * invariant from PACKAGING-CHARTER.md section 3. It also validates the self-hosted update manifest.
 *
 * Browser-only checks (force-install applies, managed policy locks the fields, auto-update lands) are
 * out of scope for this script by nature; they live as a manual checklist in docs/PACKAGE-QA.md.
 *
 * Run from the repo root:  node qa-package.js
 * Exit code is 0 only if every check passes.
 */
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const AI_HOSTS = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://copilot.microsoft.com/*",
  "https://m365.cloud.microsoft/*",
];
const EXPECTED_ID = {
  personal: "ehklamohfapoghhffcoemikbkcjnmipe",
  enterprise: "lgmabljmaealpiaddahlmlohicohljdp",
};
// Anything matching these must never appear inside a shipped zip.
const DEV_FILE_PATTERNS = [
  /\.md$/i, /\.pem$/i, /(^|\/)tests?\//i, /(^|\/)signing\//i, /(^|\/)\.git/i,
  /(^|\/)node_modules\//i, /test-scope\.js$/i, /^build\.js$/i, /^package\.js$/i,
  /^qa-package\.js$/i, /managed-policy-template\.json$/i, /(^|\/)docs\//i, /(^|\/)dist\//i,
];

let failures = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) failures++;
}

// Extension id = first 128 bits of SHA-256(DER public key), each hex nibble mapped 0->a .. f->p.
function idFromKey(keyB64) {
  const der = Buffer.from(keyB64, "base64");
  const h = crypto.createHash("sha256").update(der).digest("hex").slice(0, 32);
  return h.split("").map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

// List entries in a zip, and read one text file out of it, via the system unzip.
function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean);
}
function readFromZip(zipPath, entry) {
  return execFileSync("unzip", ["-p", zipPath, entry], { encoding: "utf8" });
}

function eqSet(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

console.log("Turrigan Guard packaged-build QA (WI-P8)\n");

// Rebuild the packages so QA runs on fresh artifacts and proves the build is reproducible.
console.log("Rebuilding packages (build.js + package.js):");
require("./build");
require("./package");
console.log("");

const VERSION = JSON.parse(fs.readFileSync("personal/manifest.json", "utf8")).version;

for (const ed of ["personal", "enterprise"]) {
  console.log(`\n[${ed}]  dist/${ed}-${VERSION}.zip`);
  const zip = path.resolve("dist", `${ed}-${VERSION}.zip`);
  check("zip exists and is non-empty", fs.existsSync(zip) && fs.statSync(zip).size > 0);
  if (!fs.existsSync(zip)) continue;

  const entries = zipEntries(zip);
  check("manifest.json at archive root", entries.includes("manifest.json"));

  const offenders = entries.filter((e) => DEV_FILE_PATTERNS.some((re) => re.test(e)));
  check("no dev files in package", offenders.length === 0, offenders.join(", "));

  const m = JSON.parse(readFromZip(zip, "manifest.json"));
  check("version matches", m.version === VERSION, `${m.version} vs ${VERSION}`);
  check("stable id derives from key", m.key && idFromKey(m.key) === EXPECTED_ID[ed],
        m.key ? idFromKey(m.key) : "no key");
  check("host_permissions are exactly the 6 AI hosts", eqSet(m.host_permissions || [], AI_HOSTS));
  check("content_scripts match exactly the 6 AI hosts",
        m.content_scripts && m.content_scripts.length === 1 && eqSet(m.content_scripts[0].matches, AI_HOSTS));
  for (const s of [16, 32, 48, 128]) {
    check(`icon ${s} present`, entries.includes(`icons/icon${s}.png`));
  }

  if (ed === "personal") {
    // Zero-egress invariant: no permissions, no background, no extra host reach at all.
    check("personal declares NO permissions", !("permissions" in m) || (m.permissions || []).length === 0);
    check("personal declares NO background worker", !("background" in m));
    check("personal declares NO optional_host_permissions",
          !("optional_host_permissions" in m) || (m.optional_host_permissions || []).length === 0);
  } else {
    check("enterprise permissions are exactly storage + alarms", eqSet(m.permissions || [], ["storage", "alarms"]));
    check("enterprise optional host reach is exactly api.turrigan.com",
          eqSet(m.optional_host_permissions || [], ["https://api.turrigan.com/*"]));
    check("enterprise has a background service worker", !!(m.background && m.background.service_worker));
    check("enterprise declares managed_schema", !!(m.storage && m.storage.managed_schema));
    check("managed schema file is in the package", entries.includes("schema/managed_schema.json"));
  }
}

// Self-hosted update manifest integrity.
console.log("\n[self-host]  docs/self-host/updates.xml");
const xml = fs.readFileSync(path.join("docs", "self-host", "updates.xml"), "utf8");
check("updates.xml appid is the enterprise id", xml.includes(`appid='${EXPECTED_ID.enterprise}'`));
check("updates.xml version matches package", xml.includes(`version='${VERSION}'`));
check("updates.xml codebase points at the matching .crx", xml.includes(`enterprise-${VERSION}.crx`));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
