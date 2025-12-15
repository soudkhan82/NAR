"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  MapPin,
  BarChart3,
  BellRing,
  MessageSquare,
} from "lucide-react";

/* ---------------- Types (local) ---------------- */
type Region = "North" | "Central" | "South" | "Nationwide";
type Frequency = "Daily" | "Weekly" | "Monthly";

interface FiltersState {
  region: Region;
  frequency: Frequency;
  asOf?: Date; // single date selector
}

/* ---------------- Helpers ---------------- */
const fmtDate = (d?: Date) =>
  d
    ? d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

// format as YYYY-MM-DD from the chosen date
const toLocalISO = (d?: Date) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/* ---------------- Component ---------------- */
export default function HomeDashboardPage() {
  const router = useRouter();

  const [filters, setFilters] = useState<FiltersState>({
    region: "Nationwide",
    frequency: "Daily",
    asOf: undefined,
  });

  // Max selectable date = yesterday
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const canApply = !!filters.asOf;

  // Navigate with plain YYYY-MM-DD selected date
  const goAvailabilityReports = (): void => {
    const qs = new URLSearchParams({
      region: filters.region,
      freq: filters.frequency,
      asOf: toLocalISO(filters.asOf),
    });
    router.push(`/Availability?${qs.toString()}`);
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 antialiased">
      <div className="pointer-events-none fixed inset-0 [mask-image:radial-gradient(45rem_30rem_at_20%_20%,black,transparent)]">
        <div className="absolute -top-24 -left-24 size-[28rem] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4 rounded-xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800/60 px-4 py-3 shadow-[0_0_0_1px_rgba(38,38,38,0.6)]"
        >
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <span className="font-medium tracking-wide">
              Network Reporting — Home
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Calendar Card */}
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="md:col-span-4"
          >
            <Card className="rounded-2xl border border-neutral-800/70 bg-neutral-950/70 backdrop-blur-sm shadow-[0_0_0_1px_rgba(38,38,38,0.6)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-neutral-200">
                  <CalendarDays className="h-4 w-4 text-emerald-400" /> As of
                  Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 max-w-[270px]">
                  <Calendar
                    mode="single"
                    selected={filters.asOf}
                    onSelect={(d: Date | undefined) =>
                      setFilters((f): FiltersState => ({ ...f, asOf: d }))
                    }
                    defaultMonth={maxDate}
                    disabled={{ after: maxDate }}
                    numberOfMonths={1}
                    className="w-fit"
                    classNames={{
                      months: "flex flex-col space-y-1",
                      month: "space-y-1",
                      caption:
                        "flex justify-center pt-0.5 relative items-center text-[11px] leading-tight text-neutral-200",
                      caption_label: "text-[11px] font-semibold tracking-wide",
                      nav: "space-x-1 flex items-center",
                      nav_button:
                        "h-7 w-7 rounded-md bg-neutral-800 text-neutral-200 p-0 opacity-95 hover:opacity-100 hover:ring-1 hover:ring-emerald-500/60 transition",
                      table: "w-full border-collapse",
                      head_row: "grid grid-cols-7",
                      head_cell:
                        "text-neutral-300 text-[10px] w-8 py-1 font-medium",
                      row: "grid grid-cols-7 mt-1 gap-y-1",
                      cell: "relative p-0 text-center text-[12px]",
                      day: "h-8 w-8 rounded-md p-0 font-medium text-neutral-100 aria-selected:opacity-100 hover:bg-neutral-800 hover:text-neutral-50 transition",
                      day_selected:
                        "bg-emerald-500 text-black hover:bg-emerald-400",
                      day_today:
                        "text-neutral-100 outline outline-1 outline-emerald-500/70",
                      day_outside: "text-neutral-500 opacity-70",
                      day_disabled:
                        "text-neutral-600 opacity-50 cursor-not-allowed",
                    }}
                    initialFocus
                  />
                </div>
                <div className="mt-2 text-[11px] text-neutral-400">
                  Max: {fmtDate(maxDate)}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Controls + Sections Card */}
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="md:col-span-8"
          >
            <Card className="rounded-2xl border border-neutral-800/70 bg-neutral-950/70 backdrop-blur-sm shadow-[0_0_0_1px_rgba(38,38,38,0.6)]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-400" />
                    <CardTitle className="text-base text-neutral-200">
                      Network Reporting – Home
                    </CardTitle>
                  </div>
                  <div className="hidden md:flex text-xs text-neutral-400 gap-2">
                    <span className="rounded-full border border-neutral-800 px-2 py-0.5 bg-neutral-900/60">
                      Region:{" "}
                      <span className="text-neutral-200">{filters.region}</span>
                    </span>
                    <span className="rounded-full border border-neutral-800 px-2 py-0.5 bg-neutral-900/60">
                      Frequency:{" "}
                      <span className="text-neutral-200">
                        {filters.frequency}
                      </span>
                    </span>
                    <span className="rounded-full border border-neutral-800 px-2 py-0.5 bg-neutral-900/60">
                      As of:{" "}
                      <span className="text-neutral-200">
                        {fmtDate(filters.asOf)}
                      </span>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Controls row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Region */}
                  <div className="md:col-span-5">
                    <Label className="mb-1 inline-flex items-center gap-2 text-neutral-300">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      Region
                    </Label>
                    <Select
                      value={filters.region}
                      onValueChange={(v: string) =>
                        setFilters(
                          (f): FiltersState => ({
                            ...f,
                            region: v as Region,
                          })
                        )
                      }
                    >
                      <SelectTrigger className="h-10 w-full rounded-lg border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 transition">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent className="border-neutral-800 bg-neutral-900 text-neutral-100">
                        <SelectItem value="North">North</SelectItem>
                        <SelectItem value="Central">Central</SelectItem>
                        <SelectItem value="South">South</SelectItem>
                        <SelectItem value="Nationwide">Nationwide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Frequency */}
                  <div className="md:col-span-5">
                    <Label className="mb-1 block text-neutral-300">
                      Report Frequency
                    </Label>
                    <Tabs
                      value={filters.frequency}
                      onValueChange={(v: string) =>
                        setFilters(
                          (f): FiltersState => ({
                            ...f,
                            frequency: v as Frequency,
                          })
                        )
                      }
                    >
                      <TabsList className="grid grid-cols-3 h-10 rounded-lg border border-neutral-800 bg-neutral-900">
                        <TabsTrigger
                          className="px-2 py-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-black hover:bg-neutral-800 transition"
                          value="Daily"
                        >
                          Daily
                        </TabsTrigger>
                        <TabsTrigger
                          className="px-2 py-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-black hover:bg-neutral-800 transition"
                          value="Weekly"
                        >
                          Weekly
                        </TabsTrigger>
                        <TabsTrigger
                          className="px-2 py-1 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-black hover:bg-neutral-800 transition"
                          value="Monthly"
                        >
                          Monthly
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <Separator className="bg-neutral-800" />

                {/* Sections */}
                <div className="space-y-3">
                  {/* Availability */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="group flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 hover:bg-neutral-900/70 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.35)] hover:border-emerald-600/40 transition">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition" />
                        <div>
                          <div className="font-medium text-neutral-100">
                            Availability
                          </div>
                          <div className="text-xs text-neutral-400">
                            Regional, {filters.frequency.toLowerCase()} snapshot
                            as of {fmtDate(filters.asOf)}.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={goAvailabilityReports}
                          aria-label="Open Availability reports"
                          disabled={!canApply}
                          className="rounded-lg border border-emerald-600/40 bg-neutral-900 text-neutral-100 hover:bg-emerald-500 hover:text-black hover:shadow-lg transition"
                        >
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-300 hover:text-emerald-300 hover:bg-neutral-900"
                        >
                          View Trend
                        </Button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Network Traffic */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.03 }}
                  >
                    <div className="group flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 hover:bg-neutral-900/70 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.35)] hover:border-emerald-600/40 transition">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition" />
                        <div>
                          <div className="font-medium text-neutral-100">
                            Network Traffic
                          </div>
                          <div className="text-xs text-neutral-400">
                            Throughput / volume by leg as of{" "}
                            {fmtDate(filters.asOf)}.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canApply}
                          className="rounded-lg border border-emerald-600/40 bg-neutral-900 text-neutral-100 hover:bg-emerald-500 hover:text-black hover:shadow-lg transition"
                          onClick={() => {
                            const qs = new URLSearchParams({
                              region: filters.region,
                              freq: filters.frequency,
                              asOf: toLocalISO(filters.asOf),
                            });
                            router.push(`/PSCore?${qs.toString()}`);
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-300 hover:text-emerald-300 hover:bg-neutral-900"
                        >
                          View Trend
                        </Button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Long Persistent Alarms */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.06 }}
                  >
                    <div className="group flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 hover:bg-neutral-900/70 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.35)] hover:border-emerald-600/40 transition">
                      <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition" />
                        <div>
                          <div className="font-medium text-neutral-100">
                            Long Persistent Alarms
                          </div>
                          <div className="text-xs text-neutral-400">
                            Aging & severity, {filters.region}.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canApply}
                          className="rounded-lg border border-emerald-600/40 bg-neutral-900 text-neutral-100 hover:bg-emerald-500 hover:text-black hover:shadow-lg transition"
                          onClick={() => {
                            const qs = new URLSearchParams({
                              region: filters.region,
                              freq: filters.frequency,
                              asOf: toLocalISO(filters.asOf),
                            });
                            router.push(`/LPA?${qs.toString()}`);
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-300 hover:text-emerald-300 hover:bg-neutral-900"
                        >
                          View Trend
                        </Button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Complaints */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.09 }}
                  >
                    <div className="group flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 hover:bg-neutral-900/70 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.35)] hover:border-emerald-600/40 transition">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition" />
                        <div>
                          <div className="font-medium text-neutral-100">
                            Complaints
                          </div>
                          <div className="text-xs text-neutral-400">
                            Hotspots & resolution as of {fmtDate(filters.asOf)}.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canApply}
                          className="rounded-lg border border-emerald-600/40 bg-neutral-900 text-neutral-100 hover:bg-emerald-500 hover:text-black hover:shadow-lg transition"
                          onClick={() => {
                            const qs = new URLSearchParams({
                              region: filters.region,
                              freq: filters.frequency,
                              asOf: toLocalISO(filters.asOf),
                            });
                            router.push(`/complaints/reports?${qs.toString()}`);
                          }}
                        >
                          Open
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-neutral-300 hover:text-emerald-300 hover:bg-neutral-900"
                        >
                          View Trend
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
