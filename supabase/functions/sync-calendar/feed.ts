// A family's SIDLNE schedule as an iCal feed, for Skylight, Google Calendar or Apple
// Calendar to subscribe to. Read-only; the secret token in the link is the key.

export type FeedEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  description: string | null;
  athlete: string | null;
  team: string | null;
  driver: string | null;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Lines over 75 bytes continue on the next line after a space (RFC 5545 folding)
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(familyName: string, events: FeedEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SIDLNE//Family schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`SIDLNE · ${familyName}`)}`,
    "X-WR-CALDESC:Every practice\\, game and tournament from SIDLNE",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    const start = new Date(e.start);
    const end = e.end ? new Date(e.end) : new Date(+start + 3600e3);
    const summary = e.athlete ? `${e.athlete}: ${e.title}` : e.title;
    const notes = [
      e.team ? `Team: ${e.team}` : "",
      e.driver ? `Driving: ${e.driver}` : "",
      e.description || "",
    ].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@sidlne.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end > start ? end : new Date(+start + 3600e3))}`,
      `SUMMARY:${esc(summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (notes) lines.push(`DESCRIPTION:${esc(notes)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
