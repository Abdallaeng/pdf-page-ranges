import { describe, it, expect } from "vitest";
import { parsePageRanges, formatPageList, normalizeDigits } from "../src";

// Expected values below are worked out by hand from the grammar documented in src/index.ts.
function pages(input: string, count: number) {
  const r = parsePageRanges(input, count);
  if (!r.ok) throw new Error(r.error);
  return r.pages;
}

describe("parsePageRanges", () => {
  it("parses the classic example 1-3,5,8-10", () => {
    const r = parsePageRanges("1-3,5,8-10", 12);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ranges).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 8, end: 10 },
    ]);
    expect(r.pages).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(r.warnings).toEqual([]);
  });

  it("tolerates spaces around numbers, dashes and commas", () => {
    expect(pages("  1 - 3 ,  5 ,8 -10 ", 10)).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it("accepts en dash, em dash and semicolons", () => {
    expect(pages("2–4; 6—7", 8)).toEqual([2, 3, 4, 6, 7]);
  });

  it("ignores empty tokens from stray commas", () => {
    expect(pages("1,,3,", 5)).toEqual([1, 3]);
  });

  it("reads reversed ranges in ascending order and warns", () => {
    const r = parsePageRanges("9-7", 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages).toEqual([7, 8, 9]);
    expect(r.warnings[0]).toContain("7-9");
    expect(r.warningIssues[0]).toEqual({ code: "reversed", token: "9-7", start: 7, end: 9 });
  });

  it("supports open-ended ranges and 'all'", () => {
    expect(pages("8-", 10)).toEqual([8, 9, 10]);
    expect(pages("-3", 10)).toEqual([1, 2, 3]);
    expect(pages("ALL", 3)).toEqual([1, 2, 3]);
  });

  it("removes duplicates, keeps first occurrence and typed order", () => {
    const r = parsePageRanges("5,1-3,2,5", 6);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pages).toEqual([5, 1, 2, 3]);
    expect(r.warnings.join(" ")).toContain("2 repeated pages");
    expect(r.warningIssues).toEqual([{ code: "dupes", n: 2 }]);
  });

  it("rejects pages beyond the document", () => {
    const r = parsePageRanges("1-3,12", 10);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("10 pages");
    expect(r.issue).toEqual({ code: "pastEnd", token: "12", count: 10 });
  });

  it("rejects page zero", () => {
    expect(parsePageRanges("0-2", 5).ok).toBe(false);
    expect(parsePageRanges("0", 5).ok).toBe(false);
  });

  it.each(["a", "1-2-3", "1.5", "--", "-", "3x", "1 2", "#4"])("rejects invalid token %j", (tok) => {
    const r = parsePageRanges(tok, 20);
    expect(r.ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(parsePageRanges("   ", 5).ok).toBe(false);
    expect(parsePageRanges(",,", 5).ok).toBe(false);
  });

  it("rejects a document with zero pages", () => {
    expect(parsePageRanges("1", 0).ok).toBe(false);
  });

  it("works on a single-page document", () => {
    expect(pages("1", 1)).toEqual([1]);
    expect(pages("1-", 1)).toEqual([1]);
    expect(parsePageRanges("2", 1).ok).toBe(false);
  });

  it("accepts Arabic-Indic digits and the Arabic comma", () => {
    // "١-٣،٥" = "1-3,5"
    expect(pages("١-٣،٥", 5)).toEqual([1, 2, 3, 5]);
    // Persian digits "۲-۴" = "2-4"
    expect(pages("۲-۴", 5)).toEqual([2, 3, 4]);
  });
});

describe("normalizeDigits", () => {
  it("maps digits and separators to ASCII", () => {
    expect(normalizeDigits("١٠؛۹")).toBe("10;9");
  });
});

describe("formatPageList", () => {
  it("compacts runs", () => {
    expect(formatPageList([9, 1, 2, 3, 5, 8])).toBe("1-3, 5, 8-9");
    expect(formatPageList([])).toBe("");
    expect(formatPageList([4, 4])).toBe("4");
  });

  it("round-trips with the parser", () => {
    const list = [1, 2, 3, 7, 10, 11];
    expect(pages(formatPageList(list), 11)).toEqual(list);
  });
});
