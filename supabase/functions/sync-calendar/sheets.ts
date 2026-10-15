// Reads a Google Sheet as CSV for the carpool import. Browsers can't fetch
// Google's CSV export directly (no CORS), so the app asks this function.

const MAX_SHEET_BYTES = 2_000_000;

// The CSV export link for a Google Sheets URL, or null if it isn't one
export function sheetCsvUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null;
  const m = /^\/spreadsheets\/d\/([^/]+)/.exec(url.pathname);
  if (!m) return null;
  // "Publish to web" links: /spreadsheets/d/e/<id>/pub...
  if (m[1] === "e") {
    const pub = /^\/spreadsheets\/d\/e\/([^/]+)/.exec(url.pathname);
    if (!pub) return null;
    const gid = url.searchParams.get("gid");
    return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}`;
  }
  if (!/^[A-Za-z0-9_-]{10,}$/.test(m[1])) return null;
  const gid = /[#&?]gid=(\d+)/.exec(url.search + url.hash)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

export async function fetchSheetCsv(raw: string): Promise<{ csv: string } | { error: string; status: number }> {
  const target = sheetCsvUrl(raw);
  if (!target) return { error: "That isn't a Google Sheets link. Copy the link from the Share button in Google Sheets.", status: 400 };
  let res: Response;
  try {
    res = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    return { error: `Couldn't reach Google Sheets: ${(err as Error).message}`, status: 502 };
  }
  const text = await res.text();
  const html = /^\s*</.test(text) || (res.headers.get("content-type") || "").includes("text/html");
  if (!res.ok || html) {
    return { error: "Google wouldn't share that sheet. In Google Sheets tap Share → General access → “Anyone with the link” (Viewer), then try again.", status: 403 };
  }
  if (text.length > MAX_SHEET_BYTES) return { error: "That sheet is too large to import", status: 413 };
  return { csv: text };
}
