export function Cards({ siteCount, avgPGS, avgSB }: { siteCount: number; avgPGS: number | null; avgSB: number | null }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card title="Sites in scope" value={siteCount} />
      <Card title="Avg PGS (Platinum/Gold/Strategic)" value={fmt(avgPGS)} />
      <Card title="Avg SB (Silver/Bronze)" value={fmt(avgSB)} />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function fmt(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? "—" : (n as number).toFixed(2);
}
