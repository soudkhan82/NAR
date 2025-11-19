// app/sitequery/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/app/config/supabase-config";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/* ---------- Types ---------- */

type CellAvailRaw = {
  Report_Date: string; // date as ISO string
  Overall: number | null;
  "2G": number | null;
  "3G": number | null;
  "4G": number | null;
};

type TrafficRaw = {
  Report_Date: string | null;
  RadioVoice_2G_Traffic: number | null;
  RadioVoice_3G_Traffic: number | null;
  VoLTE_Voice_Traffic: number | null;
  RadioData_3G_Traffic_GB: number | null;
  RadioData_4G_Traffic_GB: number | null;
};

// Normalized chart points
type AvailPoint = {
  dt: string;
  v2g: number | null;
  v3g: number | null;
  v4g: number | null;
  overall: number | null;
};

type TrafficPoint = {
  dt: string;
  rv2g: number | null;
  rv3g: number | null;
  volte: number | null;
  rd3g: number | null;
  rd4g: number | null;
};

type PageProps = {
  params: { id: string };
};

/* ---------- Helpers ---------- */

const formatDateLabel = (dt: string) => {
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return dt;
  }
};

const scalePct = (v: number | null): number | null =>
  typeof v === "number" ? v * 100 : null;

/* ---------- Component ---------- */

export default function SiteQueryPage({ params }: PageProps) {
  const siteName = decodeURIComponent(params.id ?? "");

  const [availData, setAvailData] = useState<AvailPoint[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteName) return;

    const fetchAll = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) Availability
        const { data: availRaw, error: availErr } = await supabase
          .from("Cell_Availability")
          .select('Report_Date, Overall, "2G", "3G", "4G"')
          .eq("SiteName", siteName)
          .order("Report_Date", { ascending: true });

        if (availErr) throw new Error(`Availability: ${availErr.message}`);

        const availRows = (availRaw ?? []) as CellAvailRaw[];

        const mappedAvail: AvailPoint[] = availRows.map((row) => ({
          dt: row.Report_Date,
          v2g: scalePct(row["2G"]),
          v3g: scalePct(row["3G"]),
          v4g: scalePct(row["4G"]),
          overall: scalePct(row.Overall),
        }));

        // 2) Traffic
        const { data: trafficRaw, error: trafficErr } = await supabase
          .from("traffic")
          .select(
            'Report_Date, "RadioVoice_2G_Traffic", "RadioVoice_3G_Traffic", "VoLTE_Voice_Traffic", "RadioData_3G_Traffic_GB", "RadioData_4G_Traffic_GB"'
          )
          .eq("Site", siteName)
          .order("Report_Date", { ascending: true });

        if (trafficErr) throw new Error(`Traffic: ${trafficErr.message}`);

        const trafficRows = (trafficRaw ?? []) as TrafficRaw[];

        const mappedTraffic: TrafficPoint[] = trafficRows
          .filter((row) => !!row.Report_Date)
          .map((row) => ({
            dt: row.Report_Date as string,
            rv2g: row.RadioVoice_2G_Traffic,
            rv3g: row.RadioVoice_3G_Traffic,
            volte: row.VoLTE_Voice_Traffic,
            rd3g: row.RadioData_3G_Traffic_GB,
            rd4g: row.RadioData_4G_Traffic_GB,
          }));

        setAvailData(mappedAvail);
        setTrafficData(mappedTraffic);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err?.message ?? "Failed to load site history.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [siteName]);

  const hasAvail = useMemo(() => availData.length > 0, [availData]);
  const hasTraffic = useMemo(() => trafficData.length > 0, [trafficData]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Site Performance analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">{siteName}</p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          Loading time-series…
        </div>
      )}

      {errorMsg && (
        <div className="text-sm text-red-600">
          Error loading data: {errorMsg}
        </div>
      )}

      {/* ================= Availability (4 separate charts) ================= */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Availability</h2>
        {hasAvail ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overall */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Overall Availability (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={availData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : `${Number(value).toFixed(2)}%`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="overall"
                      name="Overall"
                      dot={false}
                      connectNulls
                      stroke="#0f766e"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 4G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>4G Availability (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={availData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : `${Number(value).toFixed(2)}%`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="v4g"
                      name="4G"
                      dot={false}
                      connectNulls
                      stroke="#2563eb"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 3G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>3G Availability (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={availData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : `${Number(value).toFixed(2)}%`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="v3g"
                      name="3G"
                      dot={false}
                      connectNulls
                      stroke="#f97316"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 2G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>2G Availability (%)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={availData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : `${Number(value).toFixed(2)}%`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="v2g"
                      name="2G"
                      dot={false}
                      connectNulls
                      stroke="#22c55e"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No availability data found for this site.
          </div>
        )}
      </section>

      {/* ================= Traffic (5 separate charts) ================= */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Traffic</h2>
        {hasTraffic ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RadioVoice 2G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>RadioVoice 2G Traffic (Erl)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : Number(value).toFixed(2)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rv2g"
                      name="RadioVoice 2G"
                      dot={false}
                      connectNulls
                      stroke="#7c3aed"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RadioVoice 3G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>RadioVoice 3G Traffic (Erl)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : Number(value).toFixed(2)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rv3g"
                      name="RadioVoice 3G"
                      dot={false}
                      connectNulls
                      stroke="#e11d48"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* VoLTE Voice */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>VoLTE Voice Traffic (Erl)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : Number(value).toFixed(2)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="volte"
                      name="VoLTE Voice"
                      dot={false}
                      connectNulls
                      stroke="#059669"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RadioData 3G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>RadioData 3G Traffic (GB)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : Number(value).toFixed(2)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rd3g"
                      name="RadioData 3G (GB)"
                      dot={false}
                      connectNulls
                      stroke="#facc15"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RadioData 4G */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>RadioData 4G Traffic (GB)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dt"
                      tickFormatter={formatDateLabel}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={formatDateLabel}
                      formatter={(value: any) =>
                        value == null ? "—" : Number(value).toFixed(2)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rd4g"
                      name="RadioData 4G (GB)"
                      dot={false}
                      connectNulls
                      stroke="#0ea5e9"
                      strokeWidth={2.2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No traffic data found for this site.
          </div>
        )}
      </section>
    </div>
  );
}
