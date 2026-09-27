import React, { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
}

/**
 * Lightweight searchable dropdown (no extra dependency): a text input that
 * filters a list as you type, with keyboard nav and click-outside-to-close.
 * Used for Importer / CHA / Category / Bay pickers per the phase-1 feedback.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled,
  required,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectOption(opt: SearchableOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`w-full border border-slate-300 rounded-md px-3 py-2 text-sm flex items-center justify-between cursor-pointer bg-white ${
          disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "focus-within:ring-2 focus-within:ring-brand-500"
        }`}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {open ? (
          <input
            autoFocus
            className="w-full outline-none text-sm"
            value={query}
            placeholder={selected?.label ?? placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className={selected ? "text-slate-800" : "text-slate-400"}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <span className="text-slate-400 ml-2">▾</span>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {clearable && (
            <div
              className="px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 cursor-pointer"
              onClick={() => selectOption({ value: "", label: "" })}
            >
              Clear selection
            </div>
          )}
          {filtered.map((opt, idx) => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-sm cursor-pointer ${
                idx === highlight ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50"
              } ${opt.value === value ? "font-medium" : ""}`}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => selectOption(opt)}
            >
              <div>{opt.label}</div>
              {opt.sublabel && <div className="text-xs text-slate-400">{opt.sublabel}</div>}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No matches.</div>}
        </div>
      )}
      {/* Hidden input so native `required` form validation still works */}
      {required && <input tabIndex={-1} className="sr-only" value={value} required onChange={() => {}} />}
    </div>
  );
}
