import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safeCurrentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(
    () =>
      items.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize),
    [items, safeCurrentPage, pageSize],
  );

  function goToPage(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)));
  }

  return { page: safeCurrentPage, totalPages, paginatedItems, goToPage };
}
