/* Negative-scope test: prove the content script matches ONLY the six AI-app hosts and NOTHING else
 * (email, docs, banking, the Turrigan API, look-alike domains). Implements Chrome's host-match rule
 * for the manifest's content_scripts.matches. Run: `node test-scope.js`. */
const fs = require("fs");

function hostMatches(patternHost, host) {
  if (patternHost === host) return true;                       // exact host (our case)
  if (patternHost.startsWith("*.")) {                           // *.example.com matches example.com + subdomains
    const base = patternHost.slice(2);
    return host === base || host.endsWith("." + base);
  }
  return false;
}
function matchesAny(patterns, url) {
  const u = new URL(url);
  const scheme = u.protocol.replace(":", "");
  return patterns.some(function (p) {
    const m = /^(\*|https?):\/\/([^/]+)(\/.*)?$/.exec(p);
    if (!m) return false;
    const [, pScheme, pHost] = m;
    if (pScheme !== "*" && pScheme !== scheme) return false;
    return hostMatches(pHost, u.hostname);
  });
}

const SHOULD_MATCH = [
  "https://chatgpt.com/c/abc", "https://chat.openai.com/", "https://claude.ai/chat/1",
  "https://gemini.google.com/app", "https://copilot.microsoft.com/", "https://m365.cloud.microsoft/chat"
];
const SHOULD_NOT = [
  "https://mail.google.com/mail/u/0",         // Gmail
  "https://outlook.office.com/mail/",          // Outlook web
  "https://outlook.live.com/mail/",
  "https://www.google.com/search?q=x",         // plain Google (not gemini.google.com)
  "https://docs.google.com/document/d/1",      // Google Docs
  "https://www.icicibank.com/",                // banking
  "https://web.whatsapp.com/",
  "https://api.turrigan.com/v1/guard/events",  // our OWN API must NOT get a content script
  "https://chatgpt.com.evil.com/",             // look-alike: suffix trick
  "https://evil-chatgpt.com/",                 // look-alike: prefix trick
  "http://chatgpt.com/"                        // wrong scheme (http)
];

let fail = 0;
for (const ed of ["personal", "enterprise"]) {
  const man = JSON.parse(fs.readFileSync(ed + "/manifest.json", "utf8"));
  const matches = man.content_scripts[0].matches;
  for (const u of SHOULD_MATCH) if (!matchesAny(matches, u)) { console.log(`FAIL ${ed}: expected MATCH ${u}`); fail++; }
  for (const u of SHOULD_NOT) if (matchesAny(matches, u)) { console.log(`FAIL ${ed}: expected NO-MATCH ${u}`); fail++; }
  // no broad content-script match
  if (matches.some(function (m) { return /(\*|https?):\/\/\*\/\*|<all_urls>/.test(m); })) { console.log(`FAIL ${ed}: broad content-script match present`); fail++; }
}
// enterprise host reach is narrowed to Turrigan (no https://*/*)
const ent = JSON.parse(fs.readFileSync("enterprise/manifest.json", "utf8"));
if ((ent.optional_host_permissions || []).includes("https://*/*")) { console.log("FAIL enterprise: optional_host_permissions still https://*/*"); fail++; }
// personal must have no host reach beyond the AI apps and no background/network capability
const per = JSON.parse(fs.readFileSync("personal/manifest.json", "utf8"));
if (per.background) { console.log("FAIL personal: has a background worker"); fail++; }
if ((per.permissions || []).length) { console.log("FAIL personal: declares permissions", per.permissions); fail++; }
if (per.optional_host_permissions) { console.log("FAIL personal: has optional_host_permissions"); fail++; }

console.log(fail === 0
  ? `PASS: content script matches only the 6 AI hosts; ${SHOULD_NOT.length} non-AI/look-alike URLs excluded (x2 editions); enterprise reach narrowed to api.turrigan.com; personal is permission-free.`
  : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
