import type { LogLine } from "../../models/logbook";

export const PRINT_LOG_ROWS_PER_PAGE = 18;

export type PrintLogPage = {
  lines: Array<LogLine | undefined>;
  pageIndex: number;
  pageCount: number;
};

export function paginatePrintLogLines(lines: LogLine[] = [], rowsPerPage = PRINT_LOG_ROWS_PER_PAGE): PrintLogPage[] {
  const safeRowsPerPage = Math.max(1, Math.floor(rowsPerPage));
  const pageCount = Math.max(1, Math.ceil(lines.length / safeRowsPerPage));

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const start = pageIndex * safeRowsPerPage;
    const pageLines = lines.slice(start, start + safeRowsPerPage);

    return {
      lines: padPrintLogLines(pageLines, safeRowsPerPage),
      pageIndex,
      pageCount,
    };
  });
}

function padPrintLogLines(lines: LogLine[], rowsPerPage: number): Array<LogLine | undefined> {
  if (lines.length >= rowsPerPage) return lines;
  return [...lines, ...Array.from<undefined>({ length: rowsPerPage - lines.length })];
}
