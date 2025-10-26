"use client";

type Props = {
  kpis: { total: number; critical_cnt: number; gt_3d_cnt: number; gt_7d_cnt: number };
};

const Card = ({ title, value, className }: { title: string; value: number; className: string }) => (
  <div className={`rounded-2xl p-4 shadow-sm ${className}`}>
    <div className="text-sm opacity-70">{title}</div>
    <div className="text-3xl font-semibold">{value.toLocaleString()}</div>
  </div>
);

export default function LpaKpiCards({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card title="Total" value={kpis.total} className="bg-rose-50" />
      <Card title="Critical" value={kpis.critical_cnt} className="bg-orange-50" />
      <Card title="> 3 days" value={kpis.gt_3d_cnt} className="bg-amber-50" />
      <Card title="> 7 days" value={kpis.gt_7d_cnt} className="bg-yellow-50" />
    </div>
  );
}
