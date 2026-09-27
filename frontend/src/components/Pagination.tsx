import React from "react";
import { Button } from "./ui";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
// How many numbered buttons to show around the current page before
// collapsing the rest into "…", so this stays usable even with hundreds
// of pages instead of rendering a button per page.
const SIBLINGS = 1;

/** Builds a compact page list like [1, "…", 4, 5, 6, "…", 42]. */
function buildPageList(page: number, totalPages: number): (number | "…")[] {
  const first = 1;
  const last = totalPages;
  const start = Math.max(first + 1, page - SIBLINGS);
  const end = Math.min(last - 1, page + SIBLINGS);

  const pages: (number | "…")[] = [first];
  if (start > first + 1) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < last - 1) pages.push("…");
  if (last > first) pages.push(last);
  return pages;
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }: Props) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageList = buildPageList(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
      <div className="flex items-center gap-3">
        <span>
          Showing {from}–{to} of {total}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="text-xs">Rows per page</span>
            <select
              className="border border-slate-300 rounded-md px-2 py-1 text-xs"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        {pageList.map((p, idx) =>
          p === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[2rem] px-2 py-1.5 rounded-md text-sm ${
                p === page ? "bg-brand-600 text-white font-medium" : "bg-white border border-slate-300 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
