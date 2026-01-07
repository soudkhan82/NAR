// app/Rms/page.tsx
import Link from "next/link";
import supabase from "@/app/config/supabase-config";
import RmsDetailsView from "@/app/Rms/RmsDetails";
import RmsHeaderSearch from "@/app/Rms/RmsHeaderSearch";

type RmsSummaryRow = {
  region: string | null;
  subregion: string | null;

  overall_sites_count: number | null;
  rms_sites_count: number | null;
  rms_disconnected_count: number | null;

  ip_connectivity_yes: number | null;
  ip_connectivity_no: number | null;

  phase_1_missing: number | null;
  phase_2_missing: number | null;

  battery_health_lt70: number | null;

  smr_shortfall_count: number | null;
  critical_shortfall_count: number | null;
  extra_smr_count: number | null;

  ac_spd_normal: number | null;
  ac_spd_abnormal: number | null;
};

function num(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString() : "0";
}

function detailsHref(
  subregion: string | null,
  indicator: string,
  label: string
) {
  const sr = encodeURIComponent(subregion ?? "");
  const ind = encodeURIComponent(indicator);
  const lab = encodeURIComponent(label);
  return `/Rms?subregion=${sr}&indicator=${ind}&label=${lab}`;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function pct(value: number, max: number) {
  if (!max || max <= 0) return 0;
  return clamp((value / max) * 100);
}

function cellGradientStyle(value: number, maxValue: number) {
  const p = pct(value, maxValue);
  const fill = `rgba(56, 189, 248, 0.35)`;
  const base = `rgba(255, 255, 255, 0.06)`;
  return {
    backgroundImage: `linear-gradient(90deg, ${fill} ${p}%, ${base} ${p}%)`,
  } as React.CSSProperties;
}

function IndicatorCell(props: {
  subregion: string | null;
  indicator: string;
  label: string;
  value: number | null | undefined;
  maxValue: number;
}) {
  const v = Number(props.value ?? 0);
  const disabled = !props.subregion || v <= 0;

  const commonClass =
    "w-full inline-flex items-center justify-end px-2 py-1 rounded-md transition select-none";

  const style = cellGradientStyle(v, props.maxValue);

  if (disabled) {
    return (
      <span
        className={`${commonClass} text-slate-200/80`}
        style={style}
        title={props.label}
      >
        {num(v)}
      </span>
    );
  }

  return (
    <Link
      href={detailsHref(props.subregion, props.indicator, props.label)}
      className={`${commonClass} text-white hover:opacity-90 hover:ring-1 hover:ring-white/15`}
      style={style}
      title={`View sites for ${props.label} in ${props.subregion}`}
    >
      {num(v)}
    </Link>
  );
}

export default async function RmsPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  // Works in both Next 14 (object) and Next 15 (Promise)
  const sp = await Promise.resolve(searchParams ?? {});
  const subregion = String(sp.subregion ?? "").trim();
  const indicator = String(sp.indicator ?? "").trim();
  const label = String(sp.label ?? "RMS Details").trim();

  // Drill-down
  if (subregion && indicator) {
    return (
      <RmsDetailsView
        subregion={subregion}
        indicator={indicator}
        label={label}
      />
    );
  }

  const { data, error } = await supabase.rpc("fetch_rms_subregion_summary");

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="text-lg font-semibold">RMS Sub-Regional Summary</div>
          <p className="mt-2 text-sm text-slate-300">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as RmsSummaryRow[];

  const max = {
    rms_disconnected: Math.max(
      ...rows.map((r) => Number(r.rms_disconnected_count ?? 0)),
      0
    ),
    ip_yes: Math.max(...rows.map((r) => Number(r.ip_connectivity_yes ?? 0)), 0),
    ip_no: Math.max(...rows.map((r) => Number(r.ip_connectivity_no ?? 0)), 0),
    phase_1: Math.max(...rows.map((r) => Number(r.phase_1_missing ?? 0)), 0),
    phase_2: Math.max(...rows.map((r) => Number(r.phase_2_missing ?? 0)), 0),
    batt: Math.max(...rows.map((r) => Number(r.battery_health_lt70 ?? 0)), 0),
    smr_short: Math.max(
      ...rows.map((r) => Number(r.smr_shortfall_count ?? 0)),
      0
    ),
    crit: Math.max(
      ...rows.map((r) => Number(r.critical_shortfall_count ?? 0)),
      0
    ),
    extra: Math.max(...rows.map((r) => Number(r.extra_smr_count ?? 0)), 0),
    ac_norm: Math.max(...rows.map((r) => Number(r.ac_spd_normal ?? 0)), 0),
    ac_abn: Math.max(...rows.map((r) => Number(r.ac_spd_abnormal ?? 0)), 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6 space-y-4">
        <div className="relative z-50 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">
                RMS Sub-Regional Summary
              </h1>
              <p className="text-sm text-slate-300">
                Tap any indicator value to drill-down into SiteName list.
              </p>
            </div>

            {/* Right side: button + search */}
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              {/* ✅ New button */}
              <Link
                href="/Rms/region"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:border-white/15 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_18px_45px_rgba(0,0,0,0.55)]"
                title="Open Interactive Region Report"
              >
                Interactive Region Report
              </Link>

              {/* Client search box */}
              <div className="min-w-[320px] md:min-w-[420px]">
                <RmsHeaderSearch />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="max-h-[640px] overflow-y-auto overflow-x-auto rounded-2xl">
            <table className="min-w-[1550px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/90 text-slate-100 backdrop-blur">
                <tr>
                  <th className="px-3 py-3 text-left">Region</th>
                  <th className="px-3 py-3 text-left">Sub Region</th>
                  <th className="px-3 py-3 text-right">Over All Sites</th>
                  <th className="px-3 py-3 text-right">RMS Sites</th>
                  <th className="px-3 py-3 text-right">RMS Disconnected</th>
                  <th className="px-3 py-3 text-right">IP Yes</th>
                  <th className="px-3 py-3 text-right">IP No</th>
                  <th className="px-3 py-3 text-right">1 Phase Missing</th>
                  <th className="px-3 py-3 text-right">2 Phase Missing</th>
                  <th className="px-3 py-3 text-right">
                    Battery &lt;70% (Yes)
                  </th>
                  <th className="px-3 py-3 text-right">Shortfall</th>
                  <th className="px-3 py-3 text-right">Critical (&lt;95%)</th>
                  <th className="px-3 py-3 text-right">Extra</th>
                  <th className="px-3 py-3 text-right">AC SPD Normal</th>
                  <th className="px-3 py-3 text-right">AC SPD Abnormal</th>
                </tr>
              </thead>

              <tbody className="text-slate-100">
                {rows.map((r, i) => (
                  <tr
                    key={`${r.region ?? "NA"}-${r.subregion ?? "NA"}-${i}`}
                    className={`border-t border-white/10 ${
                      i % 2 === 0 ? "bg-white/0" : "bg-white/5"
                    } hover:bg-white/10 transition`}
                  >
                    <td className="px-3 py-2">{r.region ?? "-"}</td>
                    <td className="px-3 py-2 font-medium">
                      {r.subregion ?? "-"}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {num(r.overall_sites_count)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {num(r.rms_sites_count)}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="rms_disconnected"
                        label="RMS Disconnected"
                        value={r.rms_disconnected_count}
                        maxValue={max.rms_disconnected}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="ip_yes"
                        label="IP Connectivity (Yes)"
                        value={r.ip_connectivity_yes}
                        maxValue={max.ip_yes}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="ip_no"
                        label="IP Connectivity (No)"
                        value={r.ip_connectivity_no}
                        maxValue={max.ip_no}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="phase_1_missing"
                        label="1 Phase Missing"
                        value={r.phase_1_missing}
                        maxValue={max.phase_1}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="phase_2_missing"
                        label="2 Phase Missing"
                        value={r.phase_2_missing}
                        maxValue={max.phase_2}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="battery_lt70"
                        label="Battery Bank Health <70% (Yes)"
                        value={r.battery_health_lt70}
                        maxValue={max.batt}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="smr_shortfall"
                        label="SMR Shortfall"
                        value={r.smr_shortfall_count}
                        maxValue={max.smr_short}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="critical_shortfall"
                        label="Critical Shortfall (<95%)"
                        value={r.critical_shortfall_count}
                        maxValue={max.crit}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="extra_smr"
                        label="Extra SMR"
                        value={r.extra_smr_count}
                        maxValue={max.extra}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="ac_spd_normal"
                        label="AC SPD Normal"
                        value={r.ac_spd_normal}
                        maxValue={max.ac_norm}
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <IndicatorCell
                        subregion={r.subregion}
                        indicator="ac_spd_abnormal"
                        label="AC SPD Abnormal"
                        value={r.ac_spd_abnormal}
                        maxValue={max.ac_abn}
                      />
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-slate-300"
                      colSpan={15}
                    >
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 text-xs text-slate-300 border-t border-white/10">
            Tip: Only values &gt; 0 are tappable.
          </div>
        </div>
      </div>
    </div>
  );
}
