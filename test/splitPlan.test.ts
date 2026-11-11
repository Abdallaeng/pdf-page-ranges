import { describe, it, expect } from "vitest";
import { planSplit, partFileName } from "../src";

describe("planSplit", () => {
  it("makes one file per range token", () => {
    const r = planSplit({ kind: "ranges", spec: "1-3,5,8-10" }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.map((p) => p.pages)).toEqual([[1, 2, 3], [5], [8, 9, 10]]);
    expect(r.parts.map((p) => p.label)).toEqual(["pages 1-3", "page 5", "pages 8-10"]);
  });

  it("allows overlapping ranges as separate files", () => {
    const r = planSplit({ kind: "ranges", spec: "1-5,5-9" }, 9);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.map((p) => p.pages.length)).toEqual([5, 5]);
    expect(r.warnings).toEqual([]);
  });

  it("propagates range errors", () => {
    const r = planSplit({ kind: "ranges", spec: "1-30" }, 10);
    expect(r.ok).toBe(false);
  });

  it("splits every N pages with a short final part (10 pages / 3 = 3+3+3+1)", () => {
    const r = planSplit({ kind: "every", n: 3 }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.map((p) => p.pages)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
  });

  it("every N that divides evenly (12 / 4 = 3 files)", () => {
    const r = planSplit({ kind: "every", n: 4 }, 12);
    expect(r.ok && r.parts.length).toBe(3);
  });

  it("warns when N covers the whole document", () => {
    const r = planSplit({ kind: "every", n: 50 }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.length).toBe(1);
    expect(r.warnings.length).toBe(1);
    expect(r.warningIssues).toEqual([{ code: "wholeDoc" }]);
  });

  it.each([0, -2, 1.5, NaN])("rejects bad N %s", (n) => {
    expect(planSplit({ kind: "every", n }, 10).ok).toBe(false);
  });

  it("splits into single pages", () => {
    const r = planSplit({ kind: "each" }, 4);
    expect(r.ok && r.parts.map((p) => p.pages)).toEqual([[1], [2], [3], [4]]);
  });

  it("rejects an empty document", () => {
    expect(planSplit({ kind: "each" }, 0).ok).toBe(false);
  });
});

describe("partFileName", () => {
  it("names parts after their page span", () => {
    expect(partFileName("Report.PDF", { pages: [4, 5, 6], label: "" })).toBe("Report_p4-6.pdf");
    expect(partFileName("notes.pdf", { pages: [2], label: "" })).toBe("notes_p2.pdf");
    expect(partFileName(".pdf", { pages: [1], label: "" })).toBe("document_p1.pdf");
  });
});
