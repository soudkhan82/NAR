"use client";

export default function Indicator({
  label,
  current,
  prev,
  decimals = 2,
}: {
  label: string;
  current: number | null | undefined;
  prev: number | null | undefined;
  decimals?: number;
}) {
  const c = toNum(current);
  const p = toNum(prev);

  let deltaPct: number | null = null;
  if (p !== null && p !== 0 && c !== null) deltaPct = ((c - p) / p) * 100;

  const trend =
    deltaPct === null ? "flat" : deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat";

  const color =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-gray-500";

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="text-sm opacity-70">{label}</div>
        <div className="text-2xl font-semibold">
          {c === null ? "—" : c.toFixed(decimals)}
        </div>
      </div>
      <div className={`flex items-center gap-2 ${color}`}>
        <Arrow trend={trend} />
        <div className="text-sm font-medium">
          {deltaPct === null ? "—" : `${deltaPct.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

function Arrow({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l6 6h-4v10h-4V10H6z"/></svg>;
  if (trend === "down")
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-6-6h4V4h4v10h4z"/></svg>;
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 11h16v2H4z"/></svg>;
}

function toNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
