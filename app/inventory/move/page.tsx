// app/inventory/move/page.tsx
"use client";
import { toast } from "sonner";
import { useEffect, useMemo, useState, type JSX } from "react";
import supabase from "@/app/config/supabase-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

/* ─────────────────────────────
   Types
───────────────────────────── */
type EndpointType = "Site" | "Warehouse" | "R&R";
type RowScalar = string | number | boolean | null | undefined;
type AssetRow = {
  id: number;
  SiteName?: string | null;
  AssetType?: string | null;
  Remarks?: string | null;
  [key: string]: RowScalar;
};

/* ─────────────────────────────
   Constants
───────────────────────────── */
const endpointOptions = ["Site", "Warehouse", "R&R"] as const;
const WAREHOUSE_NAMES = ["Islamabad", "Lahore", "Karachi"];
const RR_NAMES = ["Huawei", "ZTE"];

const DEST_HINT: Record<EndpointType, string> = {
  Site: "Pick a SiteName from SSL.",
  Warehouse: "Pick a Warehouse name.",
  "R&R": "Pick an R&R location.",
};

const PREFERRED_COLS = ["id", "SiteName", "AssetType", "Remarks"] as const;

/* ─────────────────────────────
   Utilities
───────────────────────────── */
function isEndpointType(v: string): v is EndpointType {
  return v === "Site" || v === "Warehouse" || v === "R&R";
}

/* ─────────────────────────────
   Supabase data loaders
───────────────────────────── */
async function loadEndpointNames(kind: EndpointType): Promise<string[]> {
  if (kind === "Site") {
    const { data, error } = await supabase
      .from("SSL")
      .select("SiteName")
      .order("SiteName");
    if (error) throw error;
    return (data ?? []).map((r: any) => r.SiteName).filter((s: string) => !!s);
  }
  if (kind === "Warehouse") return WAREHOUSE_NAMES;
  return RR_NAMES;
}

async function loadAssets(
  kind: EndpointType,
  site: string
): Promise<AssetRow[]> {
  const table =
    kind === "Site"
      ? "Inventory_Master"
      : kind === "Warehouse"
      ? "Warehouse"
      : "R&R";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("SiteName", site);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, id: Number(r.id) }));
}

/* ─────────────────────────────
   RPC Wrappers
───────────────────────────── */
async function rpcLogRemoveAsset(args: {
  p_source_type: EndpointType;
  p_source_name: string;
  p_asset_id: number;
  p_asset_type: string;
  p_purpose: string | null;
  p_tx_date: string;
}) {
  const { data, error } = await supabase.rpc("log_remove_asset", args);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function rpcApplyToDestination(args: {
  p_log_id: number;
  p_dest_type: EndpointType;
  p_dest_name: string;
}) {
  const { data, error } = await supabase.rpc("apply_to_destination", args);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/* ─────────────────────────────
   Searchable Combobox
───────────────────────────── */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={(v) => {
                    onChange(v);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === opt ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────────
   Main Component
───────────────────────────── */
export default function MoveAssetPage(): JSX.Element {
  const [sourceType, setSourceType] = useState<EndpointType>("Site");
  const [destType, setDestType] = useState<EndpointType>("Site");

  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [destNames, setDestNames] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [destName, setDestName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  /* Load name options */
  useEffect(() => {
    loadEndpointNames(sourceType).then(setSourceNames).catch(console.error);
    setSourceName("");
    setAssets([]);
  }, [sourceType]);

  useEffect(() => {
    loadEndpointNames(destType).then(setDestNames).catch(console.error);
    setDestName("");
  }, [destType]);

  /* Load assets */
  useEffect(() => {
    if (!sourceName) return;
    loadAssets(sourceType, sourceName).then(setAssets).catch(console.error);
  }, [sourceName, sourceType]);

  const columns = useMemo(() => {
    if (!assets.length) return PREFERRED_COLS as unknown as string[];
    const keys = Array.from(new Set(assets.flatMap((r) => Object.keys(r))));
    const base = [...PREFERRED_COLS.filter((k) => keys.includes(k)), ...keys];
    return Array.from(new Set(base));
  }, [assets]);

  /* Toggle selections */
  const toggleOne = (id: number) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleAll = () =>
    setSelected(
      selected.length === assets.length ? [] : assets.map((a) => a.id)
    );

  const canExecute =
    sourceName && destName && selected.length > 0 && txDate.length === 10;

  /* ── Approve & Execute (2-step RPC flow) ── */
  const onApproveAndExecute = async () => {
    if (!canExecute) {
      //  alert("Please select source, destination and at least one asset.");
      toast.error("Please select source, destination and at least one asset.");
      return;
    }
    setBusy(true);
    try {
      let staged = 0,
        moved = 0;
      const byId = new Map(assets.map((a) => [a.id, a]));

      for (const id of selected) {
        const row = byId.get(id);
        if (!row) continue;
        const assetType = (row.AssetType ?? "Unknown").toString();

        // Step 1: log + remove from source
        const res1 = await rpcLogRemoveAsset({
          p_source_type: sourceType,
          p_source_name: sourceName,
          p_asset_id: id,
          p_asset_type: assetType,
          p_purpose: purpose.trim() || null,
          p_tx_date: txDate,
        });
        if (!res1?.ok || !res1?.log_id) continue;
        staged++;

        // Step 2: apply to destination
        const res2 = await rpcApplyToDestination({
          p_log_id: Number(res1.log_id),
          p_dest_type: destType,
          p_dest_name: destName,
        });
        if (res2?.ok) moved++;
      }

      // alert(`Movement complete\nStaged: ${staged}\nMoved: ${moved}`);
      toast.success(`Movement complete`, {
        description: `Staged: ${staged}, Moved: ${moved}`,
      });
      setSelected([]);
      const refreshed = await loadAssets(sourceType, sourceName);
      setAssets(refreshed);
    } catch (err) {
      //  console.error("Movement error:", err);
      // alert(String(err));
      toast.error(`Movement Error`, { description: String(err) });
    } finally {
      setBusy(false);
    }
  };

  /* ─────────────────────────────
     Render
  ───────────────────────────── */
  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Asset Movement</h1>

      {/* Source / Destination Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source */}
        <div className="space-y-3 border rounded-xl p-4">
          <h2 className="text-lg font-medium">Source</h2>
          <Label className="text-sm">Type</Label>
          <RadioGroup
            value={sourceType}
            onValueChange={(v) => isEndpointType(v) && setSourceType(v)}
            className="flex gap-4"
          >
            {endpointOptions.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`src-${opt}`} />
                <Label htmlFor={`src-${opt}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>

          <Label className="text-sm">Name</Label>
          <SearchableSelect
            value={sourceName}
            onChange={setSourceName}
            options={sourceNames}
            placeholder={`Select ${sourceType} name`}
          />
          <p className="text-xs text-muted-foreground">
            {DEST_HINT[sourceType]}
          </p>
        </div>

        {/* Destination */}
        <div className="space-y-3 border rounded-xl p-4">
          <h2 className="text-lg font-medium">Destination</h2>
          <Label className="text-sm">Type</Label>
          <RadioGroup
            value={destType}
            onValueChange={(v) => isEndpointType(v) && setDestType(v)}
            className="flex gap-4"
          >
            {endpointOptions.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`dst-${opt}`} />
                <Label htmlFor={`dst-${opt}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>

          <Label className="text-sm">Name</Label>
          <SearchableSelect
            value={destName}
            onChange={setDestName}
            options={destNames}
            placeholder={`Select ${destType} name`}
          />
          <p className="text-xs text-muted-foreground">{DEST_HINT[destType]}</p>

          <div className="space-y-2 pt-2">
            <Label className="text-sm">Purpose</Label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Reason / ticket / note"
            />
            <Label className="text-sm">Transaction Date</Label>
            <Input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">
            Assets at <span className="font-semibold">{sourceName || "—"}</span>{" "}
            ({assets.length})
          </h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={toggleAll}
              disabled={!assets.length}
            >
              {selected.length === assets.length
                ? "Unselect All"
                : "Select All"}
            </Button>
            <Button
              onClick={onApproveAndExecute}
              disabled={busy || !canExecute}
            >
              {busy
                ? "Processing..."
                : `Approve & Execute (${selected.length})`}
            </Button>
          </div>
        </div>

        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="p-2 w-10"></th>
                {columns.map((c) => (
                  <th key={c} className="p-2 text-left border-b">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Select a source to load assets…
                  </td>
                </tr>
              ) : (
                assets.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.includes(r.id)}
                        onChange={() => toggleOne(r.id)}
                      />
                    </td>
                    {columns.map((c) => (
                      <td
                        key={`${r.id}-${c}`}
                        className="p-2 border-b align-top"
                      >
                        {r[c] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
