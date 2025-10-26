"use client";

import React from "react";

type KeyOf<T> = Extract<keyof T, string>;

export type ColumnDef<T> = {
  key: KeyOf<T>;
  label: string;
  render?: (value: T[KeyOf<T>], row: T) => React.ReactNode;
};

type Props<T> = {
  title: string;
  rows: T[];
  columns: ColumnDef<T>[];
  getRowKey?: (row: T, index: number) => React.Key;
};

export default function DataTable<T>({
  title,
  rows,
  columns,
  getRowKey = (_row, i) => i,
}: Props<T>) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left p-3 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t">
                <td
                  className="p-3 text-center text-gray-500"
                  colSpan={columns.length}
                >
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={getRowKey(r, i)} className="border-t">
                  {columns.map((c) => {
                    const val = (r as Record<string, unknown>)[
                      c.key
                    ] as T[KeyOf<T>];
                    return (
                      <td key={c.key} className="p-3">
                        {c.render ? c.render(val, r) : String(val ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
