import { useMemo, useState } from "react";
import { useI18n } from "../../lib/i18n";

export const pageSizeOptions = [5, 10, 25, 50, 100] as const;
export type PageSize = (typeof pageSizeOptions)[number];

export function normalizePageSize(value: unknown, fallback: PageSize = 10): PageSize {
  return pageSizeOptions.includes(value as PageSize) ? (value as PageSize) : fallback;
}

type PaginationResult<T> = {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  pageItems: T[];
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSize) => void;
};

export function usePagination<T>(items: T[], defaultPageSize: number): PaginationResult<T> {
  const normalizedDefaultPageSize = normalizePageSize(defaultPageSize);
  const [state, setState] = useState<{ defaultPageSize: PageSize; page: number; pageSize: PageSize }>(() => ({
    defaultPageSize: normalizedDefaultPageSize,
    page: 1,
    pageSize: normalizedDefaultPageSize,
  }));
  const pageSize = state.defaultPageSize === normalizedDefaultPageSize ? state.pageSize : normalizedDefaultPageSize;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, state.defaultPageSize === normalizedDefaultPageSize ? state.page : 1), pageCount);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageCount,
    pageSize,
    pageItems,
    setPage: (nextPage) => setState({ defaultPageSize: normalizedDefaultPageSize, page: Math.min(Math.max(1, nextPage), pageCount), pageSize }),
    setPageSize: (nextPageSize) => setState({ defaultPageSize: normalizedDefaultPageSize, page: 1, pageSize: nextPageSize }),
  };
}

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

export function PaginationControls({ page, pageCount, pageSize, totalItems, onPageChange, onPageSizeChange }: PaginationControlsProps) {
  const { t } = useI18n();
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  return (
    <div className="pagination-controls" aria-label={t("pagination.controls")}>
      <p>
        {t("pagination.showing")} {startItem}–{endItem} {t("pagination.of")} {totalItems}
      </p>
      <label>
        {t("pagination.pageSize")}
        <select value={pageSize} onChange={(event) => onPageSizeChange(normalizePageSize(Number(event.target.value)))}>
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <div className="pagination-buttons">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("pagination.previous")}>‹</button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={pageNumber === page ? "active" : undefined}
            aria-current={pageNumber === page ? "page" : undefined}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label={t("pagination.next")}>›</button>
      </div>
    </div>
  );
}
