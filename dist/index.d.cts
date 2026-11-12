/** An inclusive range of 1-based page numbers. */
interface PageRange {
    /** First page, 1-based, inclusive. */
    start: number;
    /** Last page, 1-based, inclusive, >= start. */
    end: number;
}
/** Machine-readable reasons, so an interface can show the message in its own language. */
type RangeIssue = {
    code: "noPages";
} | {
    code: "empty";
} | {
    code: "badToken";
    token: string;
} | {
    code: "zero";
    token: string;
} | {
    code: "pastEnd";
    token: string;
    count: number;
} | {
    code: "reversed";
    token: string;
    start: number;
    end: number;
} | {
    code: "dupes";
    n: number;
};
type RangeParseResult = {
    ok: true;
    /** One range per token, in the order typed (reversed ranges already swapped). */
    ranges: PageRange[];
    /** Every selected page once, in the order typed (first occurrence wins). */
    pages: number[];
    /** Human-readable English warnings. */
    warnings: string[];
    /** The same warnings as codes. */
    warningIssues: RangeIssue[];
} | {
    ok: false;
    error: string;
    issue: RangeIssue;
};
/** Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits to ASCII; Arabic comma and semicolon to "," and ";". */
declare function normalizeDigits(input: string): string;
/**
 * Parse a page selection such as "1-3, 5, 8-" against a document of `pageCount` pages.
 * Never throws: returns `{ ok: false, error, issue }` for bad input.
 *
 * @example
 * parsePageRanges("1-3,5,8-10", 12)
 * // { ok: true, ranges: [{start:1,end:3},{start:5,end:5},{start:8,end:10}], pages: [1,2,3,5,8,9,10], warnings: [], ... }
 */
declare function parsePageRanges(input: string, pageCount: number): RangeParseResult;
/**
 * Compact a set of 1-based pages into range notation (sorted, de-duplicated).
 * The output parses back with {@link parsePageRanges}.
 *
 * @example
 * formatPageList([9, 1, 2, 3, 5, 8]) // "1-3, 5, 8-9"
 */
declare function formatPageList(pages: number[]): string;
/** One output file of a split. */
interface SplitPart {
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
type SplitMode = {
    kind: "ranges";
    spec: string;
} | {
    kind: "every";
    n: number;
} | {
    kind: "each";
};
type SplitIssue = RangeIssue | {
    code: "badN";
} | {
    code: "wholeDoc";
};
type SplitPlanResult = {
    ok: true;
    parts: SplitPart[];
    warnings: string[];
    warningIssues: SplitIssue[];
} | {
    ok: false;
    error: string;
    issue: SplitIssue;
};
/**
 * Turn a split request into a list of output files, each a list of 1-based page numbers.
 * Never throws: returns `{ ok: false, error, issue }` for bad input.
 *
 * @example
 * planSplit({ kind: "every", n: 3 }, 10)
 * // parts: [[1,2,3], [4,5,6], [7,8,9], [10]]
 */
declare function planSplit(mode: SplitMode, pageCount: number): SplitPlanResult;
/**
 * File name for a split part, based on its first and last page.
 *
 * @example
 * partFileName("report.pdf", { pages: [4, 5, 6], label: "pages 4-6" }) // "report_p4-6.pdf"
 */
declare function partFileName(baseName: string, part: SplitPart): string;

export { formatPageList, normalizeDigits, parsePageRanges, partFileName, planSplit };
export type { PageRange, RangeIssue, RangeParseResult, SplitIssue, SplitMode, SplitPart, SplitPlanResult };
