import { useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../../lib/i18n";
import { PaginationControls, usePagination } from "./PaginationControls";

export type ListValue = string | number | boolean | null | undefined;
export type SortableListColumn<T> = {
  key: string;
  value: (item: T) => ListValue | ListValue[];
};

export type SortDirection = "ascending" | "descending";

function searchableValue(value: ListValue | ListValue[]) {
  return (Array.isArray(value) ? value : [value])
    .filter((part) => part !== null && part !== undefined)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterAndSortItems<T>(
  items: T[],
  columns: SortableListColumn<T>[],
  query: string,
  sortKey: string,
  direction: SortDirection,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? items.filter((item) => columns.some((column) => searchableValue(column.value(item)).includes(normalizedQuery)))
    : items;
  const sortColumn = columns.find((column) => column.key === sortKey);
  if (!sortColumn) return filtered;

  return filtered.map((item, index) => ({ item, index })).sort((left, right) => {
    const leftValue = sortColumn.value(left.item);
    const rightValue = sortColumn.value(right.item);
    const leftComparable = Array.isArray(leftValue) ? leftValue.join(" ") : leftValue;
    const rightComparable = Array.isArray(rightValue) ? rightValue.join(" ") : rightValue;
    const result = typeof leftComparable === "number" && typeof rightComparable === "number"
      ? leftComparable - rightComparable
      : String(leftComparable ?? "").localeCompare(String(rightComparable ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return (direction === "ascending" ? result : -result) || left.index - right.index;
  }).map(({ item }) => item);
}

export function useSortableList<T>(items: T[], columns: SortableListColumn<T>[], defaultPageSize: number, defaultSortKey = "") {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>(() => ({ key: defaultSortKey, direction: "ascending" }));
  const processedItems = useMemo(
    () => filterAndSortItems(items, columns, query, sort.key, sort.direction),
    [items, columns, query, sort],
  );
  const pagination = usePagination(processedItems, defaultPageSize);

  return {
    query,
    setQuery(nextQuery: string) {
      setQuery(nextQuery);
      pagination.setPage(1);
    },
    sort,
    setSortKey(key: string) {
      setSort((current) => current.key === key
        ? { key, direction: current.direction === "ascending" ? "descending" : "ascending" }
        : { key, direction: "ascending" });
      pagination.setPage(1);
    },
    ...pagination,
    totalItems: processedItems.length,
  };
}

export function ListSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) {
  const { t } = useI18n();
  const accessibleLabel = label ?? t("list.search");
  return (
    <div className="list-search">
      <label>
        <span className="visually-hidden">{accessibleLabel}</span>
        <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("list.searchPlaceholder")} aria-label={accessibleLabel} />
      </label>
    </div>
  );
}

export function SortableColumnHeader({ columnKey, activeKey, direction, onSort, children }: { columnKey: string; activeKey: string; direction: SortDirection; onSort: (key: string) => void; children: ReactNode }) {
  const active = activeKey === columnKey;
  return (
    <th aria-sort={active ? direction : "none"}>
      <button type="button" className="sortable-column-button" onClick={() => onSort(columnKey)}>
        <span>{children}</span><span aria-hidden="true">{active ? (direction === "ascending" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export function ListPagination({ list }: { list: ReturnType<typeof useSortableList<any>> }) {
  return <PaginationControls page={list.page} pageCount={list.pageCount} pageSize={list.pageSize} totalItems={list.totalItems} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />;
}
