"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import supabase from "@/app/config/supabase-config";
import { openRmsQueryBySiteName } from "@/app/lib/rms/openRmsBySiteName";

type DropdownPos = { left: number; top: number; width: number };

export default function RmsHeaderSearch() {
  const [siteQ, setSiteQ] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteErr, setSiteErr] = useState<string | null>(null);
  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const debounceRef = useRef<number | null>(null);

  // ✅ anchor + portal refs
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ left: 0, top: 0, width: 0 });

  useEffect(() => setMounted(true), []);

  function doOpen(raw: string) {
    const v = raw.trim();
    if (!v) return;
    openRmsQueryBySiteName(v);
  }

  const computePos = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8; // mt-2
    setPos({
      left: Math.round(r.left),
      top: Math.round(r.bottom + gap),
      width: Math.round(r.width),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();

    const onScroll = () => computePos();
    const onResize = () => computePos();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // ✅ Close on outside click (FIXED for portal dropdown)
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const w = wrapRef.current;
      const d = dropdownRef.current;
      const t = e.target as Node | null;

      // clicks inside input wrapper OR inside portal dropdown should NOT close
      if (t && (w?.contains(t) || d?.contains(t))) return;

      setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Search logic
  useEffect(() => {
    const q = siteQ.trim();

    if (!q) {
      setSiteOptions([]);
      setSiteErr(null);
      setSiteLoading(false);
      setOpen(false);
      return;
    }

    setOpen(true);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      setSiteLoading(true);
      setSiteErr(null);

      try {
        const { data, error } = await supabase
          .from("SSL")
          .select("SiteName")
          .ilike("SiteName", `%${q}%`)
          .order("SiteName", { ascending: true })
          .limit(12);

        if (error) throw new Error(error.message);

        const opts = (data ?? [])
          .map((r: { SiteName?: string | null }) =>
            String(r?.SiteName ?? "").trim()
          )
          .filter(Boolean);

        setSiteOptions(opts);
      } catch (e: unknown) {
        setSiteErr(
          e instanceof Error ? e.message : "Failed to search SiteName."
        );
        setSiteOptions([]);
      } finally {
        setSiteLoading(false);
        setOpen(Boolean(siteQ.trim()));
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteQ]);

  const shouldShow = open && Boolean(siteQ.trim());

  const dropdown = shouldShow ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur shadow-2xl"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
      }}
    >
      {siteLoading && (
        <div className="px-4 py-3 text-sm text-white/70">Searching…</div>
      )}

      {!siteLoading && siteErr && (
        <div className="px-4 py-3 text-sm text-rose-200">{siteErr}</div>
      )}

      {!siteLoading && !siteErr && siteOptions.length === 0 && (
        <div className="px-4 py-3 text-sm text-white/60">No matches</div>
      )}

      {!siteLoading && !siteErr && siteOptions.length > 0 && (
        <div className="max-h-72 overflow-auto">
          {siteOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSiteQ(s);
                setOpen(false);
                doOpen(s);
              }}
              className="w-full text-left px-4 py-2 text-sm text-white/90 hover:bg-white/10 transition"
              title="Open RMS details in new tab"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="w-full md:w-[560px] flex items-stretch gap-2">
      <div className="relative flex-1" ref={wrapRef}>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-2">
          <div className="text-[11px] text-white/60">Search SiteName (SSL)</div>
          <input
            value={siteQ}
            onChange={(e) => setSiteQ(e.target.value)}
            onFocus={() => {
              if (siteQ.trim()) {
                setOpen(true);
                requestAnimationFrame(() => computePos());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOpen(false);
                doOpen(siteQ);
              }
              if (e.key === "Escape") {
                setSiteQ("");
                setOpen(false);
              }
            }}
            placeholder="Type SiteName…"
            className="mt-1 w-full bg-transparent outline-none text-sm text-white placeholder:text-white/40"
          />
        </div>

        {/* ✅ Portal dropdown */}
        {mounted && dropdown ? createPortal(dropdown, document.body) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          doOpen(siteQ);
        }}
        className="shrink-0 rounded-2xl border border-white/10 bg-cyan-500/20 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500/30 transition"
        title="Open RMS details for SiteName in new tab"
      >
        Fetch RMS
      </button>
    </div>
  );
}
