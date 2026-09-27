import React from "react";

interface Props {
  label: string;
  field: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
}

export default function SortHeader({ label, field, sortBy, sortDir, onSort }: Props) {
  const active = sortBy === field;
  return (
    <th
      className="px-4 py-3 cursor-pointer select-none hover:text-slate-700"
      onClick={() => onSort(field)}
    >
      {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
