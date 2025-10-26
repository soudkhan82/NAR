"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function ComboBox({
  label,
  value,
  onChange,
  fetchOptions,
  debounceMs = 250,
  placeholder = "Search…",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  fetchOptions: (term: string) => Promise<string[]>;
  debounceMs?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  // debounced fetch
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchOptions(term);
        if (active) setOpts(res);
      } finally {
        if (active) setLoading(false);
      }
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [term, fetchOptions, debounceMs]);

  // when value changes from outside, sync the input
  useEffect(() => setTerm(value ?? ""), [value]);

  return (
    <div className="flex flex-col gap-1 text-sm" ref={boxRef}>
      <span className="opacity-75">{label}</span>
      <div
        className={`relative ${
          disabled ? "opacity-60 pointer-events-none" : ""
        }`}
        onClick={() => setOpen(true)}
      >
        <input
          className="w-full px-2 py-2 rounded-lg border"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        <div className="absolute right-2 top-2.5 text-xs opacity-60">
          {loading ? "…" : "▾"}
        </div>
        {open && (
          <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow">
            {opts.length === 0 ? (
              <div className="p-2 text-xs text-gray-500">No results</div>
            ) : (
              opts.map((opt) => (
                <button
                  key={opt}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    onChange(opt);
                    setTerm(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
