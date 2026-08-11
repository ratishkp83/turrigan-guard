/* Turrigan Guard - build step.
 *
 * The two editions share the same on-device guard (core/), but a Manifest V3 extension can only load
 * files inside its own folder. So this copies core/ into personal/core and enterprise/core, making
 * each folder a self-contained, loadable unpacked extension while keeping ONE source of truth in core/.
 * Run `node build.js` after editing anything under core/. */
const fs = require("fs");
const path = require("path");

function copyCore(dest) {
  const dir = path.join(dest, "core");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync("core")) {
    if (f.endsWith(".js")) fs.copyFileSync(path.join("core", f), path.join(dir, f));
  }
  console.log("  core/ -> " + dir.replace(/\\/g, "/"));
}

console.log("Assembling loadable extensions:");
copyCore("personal");
copyCore("enterprise");
console.log("Done. Load personal/ (free, zero-egress) or enterprise/ (paid, Turrigan-connected) as unpacked.");
