# pdf-page-ranges

Parse page-range input like `1-3, 5, 8-` into page numbers, with clear errors and warnings, and plan how to split a PDF into files.

- Zero dependencies, pure functions, never throws on user input.
- Forgiving where it is safe (spaces, en/em dashes, `;`, stray commas, reversed ranges, Arabic-Indic digits) and strict where guessing would be wrong (page 0, past the end, `1.5`, `1-2-3`).
- Every error and warning comes as an English message and as a machine-readable code, so you can show your own wording or translate it.
- ESM and CommonJS builds with TypeScript declarations. Works for any paged document, not only PDF.

## Install

```sh
npm i pdf-page-ranges
```

> Not published to npm yet. Until it is, install straight from GitHub (the package builds itself on install):
>
> ```sh
> npm i github:Abdallaeng/pdf-page-ranges
> ```

### Use it in the browser (no install)

The built ES module is served free by jsDelivr straight from this repository:

```html
<script type="module">
  import { parsePageRanges } from "https://cdn.jsdelivr.net/gh/Abdallaeng/pdf-page-ranges@v1.0.0/dist/index.js";
  console.log(parsePageRanges("1-3, 5, 8-", 10).pages); // [1, 2, 3, 5, 8, 9, 10]
</script>
```

## Grammar

```
list   := token ("," | ";") token ...
token  := N | N-M | N- | -M | all
```

Pages are 1-based positions in the file, not printed page labels. `N-` runs to the last page, `-M` starts at page 1, `all` is every page. Spaces around numbers and dashes are allowed, and `–`, `—` and `−` count as `-`.

| Input | 10-page document |
| --- | --- |
| `1-3,5,8-10` | pages 1, 2, 3, 5, 8, 9, 10 |
| `8-` | 8, 9, 10 |
| `-3` | 1, 2, 3 |
| `9-7` | 7, 8, 9, with a "reversed" warning |
| `5,1-3,2,5` | 5, 1, 2, 3 (typed order, first occurrence kept), with a "dupes" warning |
| `1-3,12` | error `pastEnd` |
| `0-2` | error `zero` |
| `1.5`, `1-2-3`, `a`, `1 2` | error `badToken` |

## API

Outputs below are the values asserted in the test suite.

### `parsePageRanges(input, pageCount)`

```ts
import { parsePageRanges } from "pdf-page-ranges";

parsePageRanges("1-3, 5, 8-", 10);
// {
//   ok: true,
//   ranges: [{ start: 1, end: 3 }, { start: 5, end: 5 }, { start: 8, end: 10 }],
//   pages: [1, 2, 3, 5, 8, 9, 10],
//   warnings: [],
//   warningIssues: []
// }

parsePageRanges("9-7", 10);
// { ok: true, pages: [7, 8, 9], warnings: ['"9-7" was read as 7-9.'],
//   warningIssues: [{ code: "reversed", token: "9-7", start: 7, end: 9 }], ... }

parsePageRanges("1-3,12", 10);
// { ok: false, error: '"12" goes past the last page. This document has 10 pages.',
//   issue: { code: "pastEnd", token: "12", count: 10 } }
```

`ranges` keeps one entry per token in the order typed (useful when each range is its own output). `pages` is the flattened selection with duplicates removed.

Issue codes: `noPages`, `empty`, `badToken`, `zero`, `pastEnd` (errors) and `reversed`, `dupes` (warnings).

### `formatPageList(pages)`

```ts
import { formatPageList } from "pdf-page-ranges";

formatPageList([9, 1, 2, 3, 5, 8]); // "1-3, 5, 8-9"
formatPageList([4, 4]);             // "4"
```

The output parses back with `parsePageRanges`.

### `normalizeDigits(input)`

```ts
import { normalizeDigits, parsePageRanges } from "pdf-page-ranges";

normalizeDigits("١٠؛۹");             // "10;9"
parsePageRanges("١-٣،٥", 5).pages;   // [1, 2, 3, 5]
```

Arabic-Indic and Persian digits become ASCII; the Arabic comma and semicolon become `,` and `;`. `parsePageRanges` calls this for you.

### `planSplit(mode, pageCount)`

```ts
import { planSplit } from "pdf-page-ranges";

planSplit({ kind: "ranges", spec: "1-3,5,8-10" }, 10);
// { ok: true, parts: [
//     { pages: [1, 2, 3], label: "pages 1-3" },
//     { pages: [5], label: "page 5" },
//     { pages: [8, 9, 10], label: "pages 8-10" }
//   ], warnings: [], warningIssues: [] }

planSplit({ kind: "every", n: 3 }, 10).parts.map((p) => p.pages);
// [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

planSplit({ kind: "each" }, 4).parts.map((p) => p.pages);
// [[1], [2], [3], [4]]
```

In `ranges` mode each token becomes its own file and overlaps are allowed on purpose (`1-5,5-9` gives two 5-page files that share page 5). In `every` mode a bad `n` (0, negative, fractional, NaN) is an error `badN`, and an `n` that covers the whole document gives a `wholeDoc` warning.

### `partFileName(baseName, part)`

```ts
import { partFileName } from "pdf-page-ranges";

partFileName("Report.PDF", { pages: [4, 5, 6], label: "" }); // "Report_p4-6.pdf"
partFileName("notes.pdf", { pages: [2], label: "" });       // "notes_p2.pdf"
```

## Tests

37 Vitest cases, ported from the PDF tools where this code runs in production, cover the grammar above, every error code, single-page documents, round-tripping with `formatPageList`, and each split mode. Expected values were worked out by hand from the grammar. Run them with `npm test`.

## Limitations

- Page positions only: printed page labels (roman numerals, "A-1") are not understood.
- No step syntax (`1-10/2`), no "odd" / "even" keywords and no exclusions (`!5`).
- Messages are in English; use the issue codes to localise them.
- It plans splits and does not read or write PDF files. Pair it with a PDF library such as pdf-lib to do the actual work.

## Try it online

This parser runs the page fields of the free, in-browser tools on [PDFNova](https://pdfnova-desk.pages.dev/), where files never leave your device:

- [Split PDF](https://pdfnova-desk.pages.dev/tools/split-pdf/)
- [Extract pages](https://pdfnova-desk.pages.dev/tools/extract-pages/)

## License

MIT © Technical Design Team
