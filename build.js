/* Turrigan Guard - build step.
 *
 * The two editions share the same on-device guard (core/), but a Manifest V3 extension can only load
 * files inside its own folder. So this copies core/ into personal/core and enterprise/core, making
 * each folder a self-contained, loadable unpacked extension while keeping ONE source of truth in core/.
 * Run `node build.js` after editing anything under core/. */
const fs = require("fs");
const path = require("path");

const ICON_SIZES = [16, 32, 48, 128];

function copyCore(dest) {
  const dir = path.join(dest, "core");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync("core")) {
    if (f.endsWith(".js")) fs.copyFileSync(path.join("core", f), path.join(dir, f));
  }
  console.log("  core/ -> " + dir.replace(/\\/g, "/"));
}

// Icons live once in icons/ and are copied into each edition (MV3 loads only files inside the folder).
function copyIcons(dest) {
  const dir = path.join(dest, "icons");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of ICON_SIZES) {
    const f = `icon${s}.png`;
    fs.copyFileSync(path.join("icons", f), path.join(dir, f));
  }
  console.log("  icons/ -> " + dir.replace(/\\/g, "/"));
}

console.log("Assembling loadable extensions:");
for (const ed of ["personal", "enterprise"]) { copyCore(ed); copyIcons(ed); }
console.log("Done. Load personal/ (free, zero-egress) or enterprise/ (paid, Turrigan-connected) as unpacked.");
