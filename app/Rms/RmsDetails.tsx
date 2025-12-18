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

function siteQueryHref(siteName: string) {
  return `/sitequery/${encodeURIComponent(siteName)}`;
}

// RMS Query page path as per your requirement: app/Rms/[id]/page.tsx  => /Rms/<id>
function rmsQueryHref(siteName: string) {
  return `/Rms/${encodeURIComponent(siteName)}`;
}

function CellLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2 w-full h-full hover:opacity-90"
      title={title ?? "Open in new tab"}
    >
      {children}
    </Link>
  );
}

function PillLink({
  href,
  children,
  title,
}: {
  href: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
      title={title ?? "Open in new tab"}
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
                Use{" "}
                <span className="text-slate-200 font-medium">RMS Query</span> to
                open full RMS indicators. Click SiteName to open SiteQuery.
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
            <table className="min-w-[1050px] w-full text-sm text-slate-100">
              <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur">
                <tr>
                  <th className="px-3 py-3 text-left">RMS Query</th>
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
                  const siteHref = site ? siteQueryHref(site) : null;
                  const rmsHref = site ? rmsQueryHref(site) : null;

                  return (
                    <tr
                      key={`${r.sitename ?? "NA"}-${i}`}
                      className={`border-t border-white/10 ${
                        i % 2 === 0 ? "bg-white/0" : "bg-white/5"
                      } hover:bg-white/10 transition`}
                    >
                      {/* RMS Query button */}
                      <td className="px-3 py-2">
                        {rmsHref ? (
                          <PillLink
                            href={rmsHref}
                            title="Open RMS indicators in new tab"
                          >
                            RMS Query
                          </PillLink>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* SiteName opens SiteQuery in new tab */}
                      <td className="p-0 font-medium">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
                            {site}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">-</div>
                        )}
                      </td>

                      {/* Other columns (also open SiteQuery for convenience) */}
                      <td className="p-0">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
                            {r.region ?? "-"}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.region ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
                            {r.subregion ?? "-"}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.subregion ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
                            {r.grid ?? "-"}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.grid ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
                            {r.district ?? "-"}
                          </CellLink>
                        ) : (
                          <div className="px-3 py-2">{r.district ?? "-"}</div>
                        )}
                      </td>

                      <td className="p-0">
                        {siteHref ? (
                          <CellLink
                            href={siteHref}
                            title="Open SiteQuery in new tab"
                          >
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
                      colSpan={7}
                    >
                      No sites found for this indicator in this SubRegion.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 text-xs text-slate-300 border-t border-white/10">
            <span className="text-slate-200">RMS Query</span> opens{" "}
            <span className="text-slate-200">/Rms/[id]</span> in new tab •
            SiteName opens{" "}
            <span className="text-slate-200">/sitequery/[id]</span> in new tab
          </div>
        </div>
      </div>
    </div>
  );
}
