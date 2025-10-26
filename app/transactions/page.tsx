// app/transactions/page.tsx
"use client";

import { useEffect, useState } from "react";
import supabase from "@/app/config/supabase-config";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type TransactionRow = {
  id: number;
  created_at: string;
  source_type: string;
  source_name: string;
  asset_id: number;
  asset_type: string;
  tx_date: string;
  purpose: string | null;
  dest_type: string | null;
  dest_name: string | null;
  status: string;
  msg: string | null;
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState<TransactionRow[]>([]);

  async function loadTransactions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Asset_Transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Error loading transactions", { description: error.message });
      setLoading(false);
      return;
    }
    setRows(data ?? []);
    setFiltered(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  // Simple filter
  useEffect(() => {
    if (!search) {
      setFiltered(rows);
      return;
    }
    const s = search.toLowerCase();
    setFiltered(
      rows.filter(
        (r) =>
          r.source_name?.toLowerCase().includes(s) ||
          r.dest_name?.toLowerCase().includes(s) ||
          r.asset_type?.toLowerCase().includes(s) ||
          String(r.asset_id).includes(s)
      )
    );
  }, [search, rows]);

  return (
    <div className="p-6 max-w-[1300px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold">Asset Transactions</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Search by Site, Asset, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={loadTransactions} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="overflow-auto border rounded-2xl shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-emerald-50">
            <tr className="text-left">
              <th className="p-2">#</th>
              <th className="p-2">Created</th>
              <th className="p-2">Source</th>
              <th className="p-2">Destination</th>
              <th className="p-2">Asset Type</th>
              <th className="p-2">Asset ID</th>
              <th className="p-2">Purpose</th>
              <th className="p-2">Status</th>
              <th className="p-2">Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-muted-foreground"
                >
                  {loading
                    ? "Loading transactions…"
                    : "No transaction records found."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-emerald-50 transition"
                >
                  <td className="p-2 font-medium">{r.id}</td>
                  <td className="p-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <div className="font-medium">
                      {r.source_type} / {r.source_name}
                    </div>
                  </td>
                  <td className="p-2">
                    {r.dest_type ? (
                      <div className="font-medium">
                        {r.dest_type} / {r.dest_name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">{r.asset_type}</td>
                  <td className="p-2">{r.asset_id}</td>
                  <td className="p-2">{r.purpose || "—"}</td>
                  <td className="p-2">
                    <Badge
                      variant={
                        r.status === "moved"
                          ? "default"
                          : r.status === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-2 max-w-[250px] truncate">{r.msg || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
