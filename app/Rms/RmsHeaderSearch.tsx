"use client";

import { useEffect, useRef, useState } from "react";
import supabase from "@/app/config/supabase-config";
import { openRmsQueryBySiteName } from "@/app/lib/rms/openRmsBySiteName";

export default function RmsHeaderSearch() {
  const [siteQ, setSiteQ] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteErr, setSiteErr] = useState<string | null>(null);
  const [siteOptions, setSiteOptions] = useState<string[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const q = siteQ.trim();

    // reset when empty
    if (!q) {
      setSiteOptions([]);
      setSiteErr(null);
      setSiteLoading(false);
      return;
    }

    // debounce
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
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [siteQ]);

  function doOpen(raw: string) {
    const v = raw.trim();
    if (!v) return;
    openRmsQueryBySiteName(v); // opens /Rms/[SiteName] in new tab (as per helper)
  }

  return (
    <div className="w-full md:w-[560px] flex items-stretch gap-2">
      <div className="relative flex-1">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-2">
          <div className="text-[11px] text-white/60">Search SiteName (SSL)</div>
          <input
            value={siteQ}
            onChange={(e) => setSiteQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doOpen(siteQ);
              if (e.key === "Escape") setSiteQ("");
            }}
            placeholder="Type SiteName…"
            className="mt-1 w-full bg-transparent outline-none text-sm text-white placeholder:text-white/40"
          />
        </div>

        {(siteLoading || siteErr || siteOptions.length > 0) && siteQ.trim() && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur shadow-xl">
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
        )}
      </div>

      <button
        type="button"
        onClick={() => doOpen(siteQ)}
        className="shrink-0 rounded-2xl border border-white/10 bg-cyan-500/20 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500/30 transition"
        title="Open RMS details for SiteName in new tab"
      >
        Fetch RMS
      </button>
    </div>
  );
}
