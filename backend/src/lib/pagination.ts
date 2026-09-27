import { Request } from "express";

export interface PageParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
  orderBy: Record<string, "asc" | "desc"> | undefined;
}

/**
 * Reads page/pageSize/sortBy/sortDir from query params with sane defaults.
 * Shared across list endpoints so every screen gets the same pagination +
 * sorting contract without repeating the parsing logic.
 */
export function getPageParams(
  req: Request,
  allowedSortFields: string[],
  defaultSort: string
): PageParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "25")) || 25));
  const sortByRaw = String(req.query.sortBy ?? defaultSort);
  const sortBy = allowedSortFields.includes(sortByRaw) ? sortByRaw : defaultSort;
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
    orderBy: { [sortBy]: sortDir },
  };
}

export function paginatedResponse<T>(items: T[], total: number, params: PageParams) {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
