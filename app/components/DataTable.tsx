export default function DataTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: { key: string; label: string; render?: (v: any) => React.ReactNode }[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left p-3 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t">
                <td className="p-3 text-center text-gray-500" colSpan={columns.length}>No rows</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="p-3">{c.render ? c.render((r as any)[c.key]) : (r as any)[c.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
