// Page-range parsing and split planning for PDF (or any paged document) tools.
//
// Grammar (1-based page positions, not printed page labels):
//   list   := token ("," | ";") token ...      empty tokens (e.g. a trailing comma) are ignored
//   token  := N | N-M | N- | -M | "all"         spaces around numbers and dashes are allowed
// "N-" means N to the last page, "-M" means page 1 to M. En dash, em dash and minus sign are accepted as "-".
// Arabic-Indic and Persian digits, the Arabic comma and the Arabic semicolon are accepted.
// A reversed range such as "9-7" is read as 7-9 and reported as a warning.
// Page 0, pages beyond the document and anything else (letters, "1-2-3", "1.5") are errors.

/** An inclusive range of 1-based page numbers. */
export interface PageRange {
  /** First page, 1-based, inclusive. */
  start: number;
  /** Last page, 1-based, inclusive, >= start. */
  end: number;
}

/** Machine-readable reasons, so an interface can show the message in its own language. */
export type RangeIssue =
  | { code: "noPages" }
  | { code: "empty" }
  | { code: "badToken"; token: string }
  | { code: "zero"; token: string }
  | { code: "pastEnd"; token: string; count: number }
  | { code: "reversed"; token: string; start: number; end: number }
  | { code: "dupes"; n: number };

export type RangeParseResult =
  | {
      ok: true;
      /** One range per token, in the order typed (reversed ranges already swapped). */
      ranges: PageRange[];
      /** Every selected page once, in the order typed (first occurrence wins). */
      pages: number[];
      /** Human-readable English warnings. */
      warnings: string[];
      /** The same warnings as codes. */
      warningIssues: RangeIssue[];
    }
  | { ok: false; error: string; issue: RangeIssue };

/** Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits to ASCII; Arabic comma and semicolon to "," and ";". */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/،/g, ",")
    .replace(/؛/g, ";");
}

const TOKEN = /^(\d*)\s*-\s*(\d*)$/;

/**
 * Parse a page selection such as "1-3, 5, 8-" against a document of `pageCount` pages.
 * Never throws: returns `{ ok: false, error, issue }` for bad input.
 *
 * @example
 * parsePageRanges("1-3,5,8-10", 12)
 * // { ok: true, ranges: [{start:1,end:3},{start:5,end:5},{start:8,end:10}], pages: [1,2,3,5,8,9,10], warnings: [], ... }
 */
export function parsePageRanges(input: string, pageCount: number): RangeParseResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { ok: false, error: "The document has no pages.", issue: { code: "noPages" } };
  }
  const normalized = normalizeDigits(input).replace(/[–—−]/g, "-").trim();
  if (normalized === "") return { ok: false, error: "Enter at least one page or range, for example 1-3,5.", issue: { code: "empty" } };

  const tokens = normalized
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t !== "");
  if (tokens.length === 0) return { ok: false, error: "Enter at least one page or range, for example 1-3,5.", issue: { code: "empty" } };

  const ranges: PageRange[] = [];
  const warnings: string[] = [];
  const warningIssues: RangeIssue[] = [];

  for (const token of tokens) {
    let start: number;
    let end: number;
    if (/^all$/i.test(token)) {
      start = 1;
      end = pageCount;
    } else if (/^\d+$/.test(token)) {
      start = end = Number(token);
    } else {
      const m = token.match(TOKEN);
      if (!m || (m[1] === "" && m[2] === "")) {
        return {
          ok: false,
          error: `"${token}" is not a page number or range. Use forms like 4, 2-6, 8- or -3.`,
          issue: { code: "badToken", token },
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
        issue: { code: "pastEnd", token, count: pageCount },
      };
    }
    ranges.push({ start, end });
  }

  // Flatten in the order typed, keeping the first occurrence of each page.
  const seen = new Set<number>();
  const pages: number[] = [];
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

/**
 * Compact a set of 1-based pages into range notation (sorted, de-duplicated).
 * The output parses back with {@link parsePageRanges}.
 *
 * @example
 * formatPageList([9, 1, 2, 3, 5, 8]) // "1-3, 5, 8-9"
 */
export function formatPageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

// ---------------------------------------------------------------------------------------------
// Split planning
// ---------------------------------------------------------------------------------------------

/** One output file of a split. */
export interface SplitPart {
  /** 1-based page numbers, in output order. */
  pages: number[];
  /** Short English label, e.g. "pages 1-3" or "page 5". */
  label: string;
}

/**
 * How to split:
 * - `ranges`: one file per comma-separated range in `spec` (overlaps allowed)
 * - `every`: a new file every `n` pages (the last may be shorter)
 * - `each`: one file per page
 */
export type SplitMode = { kind: "ranges"; spec: string } | { kind: "every"; n: number } | { kind: "each" };

export type SplitIssue = RangeIssue | { code: "badN" } | { code: "wholeDoc" };

export type SplitPlanResult =
  | { ok: true; parts: SplitPart[]; warnings: string[]; warningIssues: SplitIssue[] }
  | { ok: false; error: string; issue: SplitIssue };

function labelFor(start: number, end: number): string {
  return start === end ? `page ${start}` : `pages ${start}-${end}`;
}

function span(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Turn a split request into a list of output files, each a list of 1-based page numbers.
 * Never throws: returns `{ ok: false, error, issue }` for bad input.
 *
 * @example
 * planSplit({ kind: "every", n: 3 }, 10)
 * // parts: [[1,2,3], [4,5,6], [7,8,9], [10]]
 */
export function planSplit(mode: SplitMode, pageCount: number): SplitPlanResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: "The document has no pages.", issue: { code: "noPages" } };

  if (mode.kind === "each") {
    return { ok: true, parts: span(1, pageCount).map((p) => ({ pages: [p], label: labelFor(p, p) })), warnings: [], warningIssues: [] };
  }

  if (mode.kind === "every") {
    const n = mode.n;
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Pages per file must be a whole number of 1 or more.", issue: { code: "badN" } };
    const parts: SplitPart[] = [];
    for (let s = 1; s <= pageCount; s += n) {
      const e = Math.min(s + n - 1, pageCount);
      parts.push({ pages: span(s, e), label: labelFor(s, e) });
    }
    const whole = n >= pageCount;
    const warnings = whole ? ["That size covers the whole document, so only one file will be made."] : [];
    return { ok: true, parts, warnings, warningIssues: whole ? [{ code: "wholeDoc" }] : [] };
  }

  // Each comma-separated range becomes its own file. Overlaps are allowed on purpose:
  // someone may want "1-5" and "5-9" as two handouts that share page 5.
  const parsed = parsePageRanges(mode.spec, pageCount);
  if (!parsed.ok) return parsed;
  const parts = parsed.ranges.map((r) => ({ pages: span(r.start, r.end), label: labelFor(r.start, r.end) }));
  const warnings = parsed.warnings.filter((w) => !w.includes("repeated page"));
  const warningIssues = parsed.warningIssues.filter((w) => w.code !== "dupes");
  return { ok: true, parts, warnings, warningIssues };
}

/**
 * File name for a split part, based on its first and last page.
 *
 * @example
 * partFileName("report.pdf", { pages: [4, 5, 6], label: "pages 4-6" }) // "report_p4-6.pdf"
 */
export function partFileName(baseName: string, part: SplitPart): string {
  const stem = baseName.replace(/\.pdf$/i, "") || "document";
  const first = part.pages[0];
  const last = part.pages[part.pages.length - 1];
  return `${stem}_p${first === last ? first : `${first}-${last}`}.pdf`;
}
