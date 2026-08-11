/* Turrigan Guard - package pipeline (WI-P4).
 *
 * Assembles the loadable folders (via build.js) and produces the store-upload zips in dist/.
 * The two edition folders contain ONLY loadable extension files (manifest, scripts, popup, core/,
 * icons/, and enterprise's schema/); dev files (tests, docs, signing) live at the repo root and are
 * never inside them, so zipping each folder is already clean.
 *
 * Store upload: dist/personal.zip -> Chrome Web Store (public) + Edge Add-ons; dist/enterprise.zip ->
 * both as UNLISTED. Self-hosted .crx signing for sovereign clients is a separate, key-in-hand step,
 * see docs/SELF-HOST.md (it needs the private key from your secure store).
 *
 * Run from the repo root:  node package.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

require("./build"); // assemble core/ + icons/ into each edition

const VERSION = JSON.parse(fs.readFileSync("personal/manifest.json", "utf8")).version;
fs.mkdirSync("dist", { recursive: true });

function zipEdition(ed) {
  const out = path.resolve("dist", `${ed}-${VERSION}.zip`);
  if (fs.existsSync(out)) fs.unlinkSync(out);
  // Zip from INSIDE the edition folder so manifest.json sits at the archive root (a store requirement).
  // -X drops platform extra-attributes; -q quiet; -r recursive.
  execFileSync("zip", ["-r", "-X", "-q", out, "."], { cwd: ed });
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`  dist/${ed}-${VERSION}.zip  (${kb} KB)`);
}

console.log(`\nPackaging Turrigan Guard v${VERSION}:`);
zipEdition("personal");
zipEdition("enterprise");
console.log("Done. Upload personal (public) and enterprise (unlisted) to the Chrome Web Store + Edge Add-ons.");
