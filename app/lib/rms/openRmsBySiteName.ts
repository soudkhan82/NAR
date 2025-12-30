// app/lib/rms/openRmsBySiteName.ts

export function buildRmsQueryHref(siteNameRaw: string) {
  const site = (siteNameRaw ?? "").trim();
  return `/Rms/${encodeURIComponent(site)}`;
}

export function openRmsQueryBySiteName(siteNameRaw: string) {
  const site = (siteNameRaw ?? "").trim();
  if (!site) return;
  if (typeof window === "undefined") return;

  window.open(buildRmsQueryHref(site), "_blank", "noopener,noreferrer");
}
