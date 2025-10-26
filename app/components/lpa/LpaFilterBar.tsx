"use client";

import { useEffect, useState } from "react";
import { fetchLpaFilters, type FilterState } from "@/app/lib/rpc/lpa";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onRefresh: () => void;
};

const ALL = "__ALL__";

export default function LpaFilterBar({ value, onChange, onRefresh }: Props) {
  const [opts, setOpts] = useState<{
    regions: string[];
    subs: string[];
    crit: string[];
    slabs: string[];
  }>({
    regions: [],
    subs: [],
    crit: [],
    slabs: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const f = await fetchLpaFilters();
        if (!mounted) return;
        setOpts({
          regions: (f?.regions ?? []).map((x) => x?.v ?? "").filter(Boolean),
          subs: (f?.subregions ?? []).map((x) => x?.v ?? "").filter(Boolean),
          crit: (f?.critical ?? []).map((x) => x?.v ?? "").filter(Boolean),
          slabs: (f?.aging_slabs ?? []).map((x) => x?.v ?? "").filter(Boolean),
        });
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleVal = (v: string | null | undefined) => (v === ALL ? null : v);

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <Select
        value={value.region ?? undefined}
        onValueChange={(v) => onChange({ region: handleVal(v) })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Regions</SelectItem>
          {opts.regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.subregion ?? undefined}
        onValueChange={(v) => onChange({ subregion: handleVal(v) })}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Subregion" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Subregions</SelectItem>
          {opts.subs.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.critical ?? undefined}
        onValueChange={(v) => onChange({ critical: handleVal(v) })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Critical" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          {opts.crit.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.aging_slab ?? undefined}
        onValueChange={(v) => onChange({ aging_slab: handleVal(v) })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Aging slab" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          {opts.slabs.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="w-64"
        placeholder="Search (site, alarm code, object, problem)"
        value={value.search ?? ""}
        onChange={(e) => onChange({ search: e.target.value || null })}
      />

      <Button onClick={onRefresh} disabled={loading}>
        {loading ? "Loading..." : "Refresh"}
      </Button>
    </div>
  );
}
