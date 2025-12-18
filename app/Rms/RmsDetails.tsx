// app/Rms/rmsDetails.tsx
import Link from "next/link";
import supabase from "@/app/config/supabase-config";

type SiteRow = {
  sitename: string | null;
  region: string | null;
  subregion: string | null;
  grid: string | null;
  district: string | null;
  siteclassification: string | null;
};

function hrefFor(siteName: string) {
  return `/sitequery/${encodeURIComponent(siteName)}`;
}

function CellLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2 w-full h-full hover:opacity-90"
      title="Open SiteQuery in new tab"
    >
      {children}
    </Link>
  );
}

export default async function RmsDetailsView({
  subregion,
  indicator,
  label,
}: {
  subregion: string;
  indicator: string;
  label: string;
}) {
  const { data, error } = await supabase.rpc("fetch_rms_sites_by_indicator", {
    p_subregion: subregion,
    p_indicator: indicator,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="text-lg font-semibold">RMS Details</div>
          <p className="mt-2 text-sm text-slate-300">Error: {error.message}</p>
          <Link className="inline-block mt-4 underline" href="/Rms">
            ← Back to Summary
          </Link>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as SiteRow[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="p-6 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{label}</h1>
              <p className="text-sm text-slate-300">
                SubRegion:{" "}
                <span className="font-medium text-slate-100">{subregion}</span>
                {" • "}
                Sites:{" "}
                <span className="font-medium text-slate-100">
                  {rows.length}
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Tap any row to open SiteQuery.
              </p>
            </div>

            <Link
              href="/Rms"
              className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
            >
              ← Back
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="max-h-[720px] overflow-auto rounded-2xl">
            <table className="min-w-[900px] w-full text-sm text-slate-100">
              <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur">
                <tr>
                  <th className="px-3 py-3 text-left">SiteName</th>
                  <th className="px-3 py-3 text-left">Region</th>
                  <th className="px-3 py-3 text-left">SubRegion</th>
                  <th className="px-3 py-3 text-left">Grid</th>
                  <th className="px-3 py-3 text-left">District</th>
                  <th className="px-3 py-3 text-left">Class</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => {
                  const site = r.sitename?.trim();
                  const link = site ? hrefFor(site) : null;

                  return (
                    <tr
                      key={`${r.sitename ?? "NA"}-${i}`}
                      className={`border-t border-white/10 ${
                        i % 2 === 0 ? "bg-white/0" : "bg-white/5"
                      } hover:bg-white/10 transition ${
                        link ? "cursor-pointer" : ""
                      }`}
                    >
                      {/* Make each cell clickable by wrapping content with Link */}
                      <td className="p-0 font-medium">
                        {link ? (
                          <CellLink href={link}>{site}</CellLink>
                        ) : (
                          <div className="px-3 py-2">-</div>
                        )}
                      </td>

                      <td className="p-0">
                        {link ? (
                          <CellLink href={link}>{r.region ?? "-"}</CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.region ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {link ? (
                          <CellLink href={link}>{r.subregion ?? "-"}</CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.subregion ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {link ? (
                          <CellLink href={link}>{r.grid ?? "-"}</CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.grid ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {link ? (
                          <CellLink href={link}>{r.district ?? "-"}</CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.district ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {link ? (
                          <CellLink href={link}>
                            {r.siteclassification ?? "-"}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">
                            {r.siteclassification ?? "-"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-slate-300"
                      colSpan={6}
                    >
                      No sites found for this indicator in this SubRegion.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 text-xs text-slate-300 border-t border-white/10">
            Row tap opens:{" "}
            <span className="text-slate-200">/sitequery/[id]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
