/* Turrigan Guard (spike) - on-device PII detector.
 *
 * Pure JS, no network. Precision-first: the dangerous failure here is the FALSE POSITIVE (nagging the
 * user on every prompt), so structured identifiers are matched by shape (+ a checksum where one
 * exists), and "soft" data points that share a shape with ordinary text (date of birth, passport,
 * national id) are only flagged when an explicit CONTEXT CUE sits right next to the value. A bare date
 * is never a DOB; "date of birth 14/03/1988" is.
 *
 * This is still the on-device tier. Unstructured PII (names, postal addresses, free-form) needs the
 * contextual server NER (Turrigan pii-ner) - that gap is the enterprise/Turrigan upgrade, by design.
 *
 * Returns an AGGREGATED, MASKED summary [{type, count, sample}] - never the raw value.
 */
(function () {
  "use strict";

  // ---- checksums -------------------------------------------------------------------------------
  function luhn(candidate) {
    var s = String(candidate).replace(/\D/g, "");
    if (s.length < 13 || s.length > 19) return false;
    if (/^(\d)\1*$/.test(s)) return false; // all-identical digits (0000..., 1111...) are not a real card
    var sum = 0, alt = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var d = s.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function ibanOk(raw) {
    var s = String(raw).replace(/\s+/g, "").toUpperCase();
    if (s.length < 15 || s.length > 34) return false;
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
    var re = s.slice(4) + s.slice(0, 4), expanded = "";
    for (var i = 0; i < re.length; i++) {
      var ch = re.charCodeAt(i);
      expanded += (ch >= 65 && ch <= 90) ? String(ch - 55) : String.fromCharCode(ch);
    }
    var rem = 0;
    for (var j = 0; j < expanded.length; j++) rem = (rem * 10 + (expanded.charCodeAt(j) - 48)) % 97;
    return rem === 1;
  }

  // Phone validation, precision-first. Accepts a candidate only if its digit count is in phone range
  // and it is shaped like a phone number, so it catches Indian 5-5 grouping (98989 78548), +country
  // code, and NANP, without flagging bare long ids. National numbers are 10 to 11 digits; 12 to 13
  // digits count only when a "+" country code is present (so a 12-digit Aadhaar or reference id without
  // a "+" is not mistaken for a phone). A bare run with no "+" and no separator counts only at 10 to 11.
  function phoneOk(v) {
    var raw = String(v).trim();
    var d = raw.replace(/\D/g, "");
    if (d.length < 10 || d.length > 13) return false;
    if (/^(\d)\1*$/.test(d)) return false;              // all-identical digits are not a real number
    var hasPlus = /\+/.test(raw);
    if (d.length > 11 && !hasPlus) return false;        // 12 to 13 digits are a phone only with a + code
    var hasSep = /[\s.\-]/.test(raw);
    var contiguous = /^\d{10,11}$/.test(raw);
    if (!hasPlus && !hasSep && !contiguous) return false;
    return true;
  }

  function mask(v) {
    var s = String(v).replace(/\s+/g, " ").trim();
    if (s.length <= 4) return new Array(s.length + 1).join("•");
    return new Array(Math.max(0, s.length - 4) + 1).join("•") + s.slice(-4);
  }

  // ---- finders (each returns an array of raw matched strings) -----------------------------------
  function reFinder(re, validate) {
    return function (text) {
      var out = [], m, r = new RegExp(re.source, re.flags.indexOf("g") < 0 ? re.flags + "g" : re.flags);
      while ((m = r.exec(text)) !== null) {
        if (r.lastIndex === m.index) r.lastIndex++;
        var v = m[m.length - 1] || m[0];
        if (validate && !validate(v)) continue;
        out.push(v);
      }
      return out;
    };
  }

  // Context-anchored: for each CUE, scan the next `win` chars for the FIRST value that qualifies.
  // `valueSrc` is a regex source string; `mustHaveDigit` skips an ordinary following word (so
  // "passport office was helpful" does not match, but "passport number AB1234567" does).
  function cueFinder(cueRe, valueSrc, win, mustHaveDigit) {
    return function (text) {
      var out = [], m, c = new RegExp(cueRe.source, "gi");
      while ((m = c.exec(text)) !== null) {
        var after = text.slice(m.index + m[0].length, m.index + m[0].length + (win || 24));
        var v = new RegExp(valueSrc, "g"), vm;
        while ((vm = v.exec(after)) !== null) {
          if (v.lastIndex === vm.index) v.lastIndex++;
          var val = (vm[1] || vm[0]).trim();
          if (mustHaveDigit && !/\d/.test(val)) continue;
          out.push(val);
          break; // first qualifying value next to the cue
        }
        if (c.lastIndex === m.index) c.lastIndex++;
      }
      return out;
    };
  }

  // A date in numeric or month-name form. Only ever flagged as DOB via a nearby birth cue (below).
  var DATE_SRC = "(?:\\d{1,4}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{1,4}" +
    "|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?,?\\s+\\d{2,4}" +
    "|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{2,4})";
  var BIRTH_CUE = /\b(?:d\.?o\.?b\.?|date of birth|birth\s?date|birth\s?day|born)\b/i;

  function dobFinder(text) {
    var out = [], m, dre = new RegExp(DATE_SRC, "gi");
    while ((m = dre.exec(text)) !== null) {
      if (dre.lastIndex === m.index) dre.lastIndex++;
      var s = Math.max(0, m.index - 24), e = Math.min(text.length, m.index + m[0].length + 8);
      if (BIRTH_CUE.test(text.slice(s, e))) out.push(m[0].trim());
    }
    return out;
  }

  var FINDERS = [
    { type: "email", find: reFinder(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/) },
    { type: "us_ssn", find: reFinder(/\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/) },
    { type: "emirates_id", find: reFinder(/\b784-?\d{4}-?\d{7}-?\d\b/) },
    { type: "credit_card", find: reFinder(/\b(?:\d[ \-]?){13,19}\b/, luhn) },
    { type: "iban", find: reFinder(/\b[A-Za-z]{2}\d{2}(?:[ ]?[A-Za-z0-9]){11,30}\b/, ibanOk) },
    { type: "phone", find: reFinder(/\+?\d[\d\s().\-]{8,16}\d/, phoneOk) },
    { type: "date_of_birth", find: dobFinder },
    // context-anchored, digit-required so an ordinary following word does not match:
    { type: "passport", find: cueFinder(/\bpassport\b/i, "[A-Za-z0-9]{6,9}", 28, true) },
    { type: "aadhaar", find: cueFinder(/\baadhaa?r\b/i, "\\d{4}\\s?\\d{4}\\s?\\d{4}", 28, true) }
  ];

  function detect(text) {
    if (!text || typeof text !== "string") return [];
    var out = {};
    for (var i = 0; i < FINDERS.length; i++) {
      var f = FINDERS[i], vals;
      try { vals = f.find(text) || []; } catch (e) { vals = []; }
      for (var j = 0; j < vals.length; j++) {
        if (!vals[j]) continue;
        if (!out[f.type]) out[f.type] = { type: f.type, count: 0, sample: mask(vals[j]) };
        out[f.type].count++;
      }
    }
    return Object.keys(out).map(function (k) { return out[k]; });
  }

  var g = (typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
  g.__TurriGuard = g.__TurriGuard || {};
  g.__TurriGuard.detect = detect;
})();
