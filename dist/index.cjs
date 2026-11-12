'use strict';

// src/index.ts
function normalizeDigits(input) {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/،/g, ",").replace(/؛/g, ";");
}
var TOKEN = /^(\d*)\s*-\s*(\d*)$/;
function parsePageRanges(input, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { ok: false, error: "The document has no pages.", issue: { code: "noPages" } };
  }
  const normalized = normalizeDigits(input).replace(/[–—−]/g, "-").trim();
  if (normalized === "") return { ok: false, error: "Enter at least one page or range, for example 1-3,5.", issue: { code: "empty" } };
  const tokens = normalized.split(/[,;]/).map((t) => t.trim()).filter((t) => t !== "");
  if (tokens.length === 0) return { ok: false, error: "Enter at least one page or range, for example 1-3,5.", issue: { code: "empty" } };
  const ranges = [];
  const warnings = [];
  const warningIssues = [];
  for (const token of tokens) {
    let start;
    let end;
    if (/^all$/i.test(token)) {
      start = 1;
      end = pageCount;
    } else if (/^\d+$/.test(token)) {
      start = end = Number(token);
    } else {
      const m = token.match(TOKEN);
      if (!m || m[1] === "" && m[2] === "") {
        return {
          ok: false,
          error: `"${token}" is not a page number or range. Use forms like 4, 2-6, 8- or -3.`,
          issue: { code: "badToken", token }
        };
      }
      start = m[1] === "" ? 1 : Number(m[1]);
      end = m[2] === "" ? pageCount : Number(m[2]);
    }
    if (start === 0 || end === 0) {
      return { ok: false, error: `"${token}": page numbering starts at 1.`, issue: { code: "zero", token } };
    }
    if (start > end) {
      warnings.push(`"${token}" was read as ${end}-${start}.`);
      warningIssues.push({ code: "reversed", token, start: end, end: start });
      [start, end] = [end, start];
    }
    if (end > pageCount) {
      return {
        ok: false,
        error: `"${token}" goes past the last page. This document has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
        issue: { code: "pastEnd", token, count: pageCount }
      };
    }
    ranges.push({ start, end });
  }
  const seen = /* @__PURE__ */ new Set();
  const pages = [];
  let dupes = 0;
  for (const r of ranges) {
    for (let p = r.start; p <= r.end; p++) {
      if (seen.has(p)) {
        dupes++;
        continue;
      }
      seen.add(p);
      pages.push(p);
    }
  }
  if (dupes > 0) {
    warnings.push(`${dupes} repeated page${dupes === 1 ? " was" : "s were"} included only once.`);
    warningIssues.push({ code: "dupes", n: dupes });
  }
  return { ok: true, ranges, pages, warnings, warningIssues };
}
function formatPageList(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
function labelFor(start, end) {
  return start === end ? `page ${start}` : `pages ${start}-${end}`;
}
function span(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
function planSplit(mode, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: "The document has no pages.", issue: { code: "noPages" } };
  if (mode.kind === "each") {
    return { ok: true, parts: span(1, pageCount).map((p) => ({ pages: [p], label: labelFor(p, p) })), warnings: [], warningIssues: [] };
  }
  if (mode.kind === "every") {
    const n = mode.n;
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Pages per file must be a whole number of 1 or more.", issue: { code: "badN" } };
    const parts2 = [];
    for (let s = 1; s <= pageCount; s += n) {
      const e = Math.min(s + n - 1, pageCount);
      parts2.push({ pages: span(s, e), label: labelFor(s, e) });
    }
    const whole = n >= pageCount;
    const warnings2 = whole ? ["That size covers the whole document, so only one file will be made."] : [];
    return { ok: true, parts: parts2, warnings: warnings2, warningIssues: whole ? [{ code: "wholeDoc" }] : [] };
  }
  const parsed = parsePageRanges(mode.spec, pageCount);
  if (!parsed.ok) return parsed;
  const parts = parsed.ranges.map((r) => ({ pages: span(r.start, r.end), label: labelFor(r.start, r.end) }));
  const warnings = parsed.warnings.filter((w) => !w.includes("repeated page"));
  const warningIssues = parsed.warningIssues.filter((w) => w.code !== "dupes");
  return { ok: true, parts, warnings, warningIssues };
}
function partFileName(baseName, part) {
  const stem = baseName.replace(/\.pdf$/i, "") || "document";
  const first = part.pages[0];
  const last = part.pages[part.pages.length - 1];
  return `${stem}_p${first === last ? first : `${first}-${last}`}.pdf`;
}

exports.formatPageList = formatPageList;
exports.normalizeDigits = normalizeDigits;
exports.parsePageRanges = parsePageRanges;
exports.partFileName = partFileName;
exports.planSplit = planSplit;
