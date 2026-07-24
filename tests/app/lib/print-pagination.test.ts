import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../../fixtures/logbook";
import { paginatePrintLogLines, PRINT_LOG_ROWS_PER_PAGE } from "../../../app/components/logbook/print-pagination";

const sampleLines = sampleLogSheets[0].lines;

describe("paginatePrintLogLines", () => {
  it("renders one fully blank page for empty sheets", () => {
    const pages = paginatePrintLogLines([]);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ pageIndex: 0, pageCount: 1 });
    expect(pages[0].lines).toHaveLength(PRINT_LOG_ROWS_PER_PAGE);
    expect(pages[0].lines.every((line) => line === undefined)).toBe(true);
  });

  it("pads a partially filled page with blank rows", () => {
    const pages = paginatePrintLogLines(sampleLines.slice(0, 3), 5);

    expect(pages).toHaveLength(1);
    expect(pages[0].lines).toHaveLength(5);
    expect(pages[0].lines.slice(0, 3)).toEqual(sampleLines.slice(0, 3));
    expect(pages[0].lines.slice(3)).toEqual([undefined, undefined]);
  });

  it("splits long sheets across fixed-size pages with page metadata", () => {
    const longLines = Array.from({ length: PRINT_LOG_ROWS_PER_PAGE + 2 }, (_, index) => ({
      ...sampleLines[index % sampleLines.length],
      time: `2026-05-14T${String(index).padStart(2, "0")}:00`,
    }));

    const pages = paginatePrintLogLines(longLines);

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.pageIndex)).toEqual([0, 1]);
    expect(pages.every((page) => page.pageCount === 2)).toBe(true);
    expect(pages.every((page) => page.lines.length === PRINT_LOG_ROWS_PER_PAGE)).toBe(true);
    expect(pages[1].lines.filter(Boolean)).toHaveLength(2);
  });
});
