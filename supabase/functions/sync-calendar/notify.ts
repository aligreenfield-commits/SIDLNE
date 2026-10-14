// Turns detected schedule changes into a short push notification, in the
// phone's own time zone.

export type ChangeRow = {
  kind: "time" | "location" | "cancelled" | "added";
  title: string;
  event_id: string | null;
  old_start: string | null;
  new_start: string | null;
  old_location: string | null;
  new_location: string | null;
};

const fmt = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts }).format(new Date(iso));
  }
};
const day = (iso: string, tz: string) => fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });
const time = (iso: string, tz: string) => fmt(iso, tz, { hour: "numeric", minute: "2-digit" });

export function changeLine(c: ChangeRow, tz: string): string {
  switch (c.kind) {
    case "time": {
      const was = c.old_start && day(c.old_start, tz) === day(c.new_start!, tz)
        ? time(c.old_start, tz)
        : `${day(c.old_start!, tz)} ${time(c.old_start!, tz)}`;
      return `${c.title} moved to ${day(c.new_start!, tz)} at ${time(c.new_start!, tz)} (was ${was})`;
    }
    case "location":
      return `${c.title} on ${day(c.new_start!, tz)} is now at ${c.new_location || "a new location"}`;
    case "cancelled":
      return `${c.title} on ${day(c.old_start!, tz)} at ${time(c.old_start!, tz)} was cancelled`;
    case "added":
      return `New: ${c.title} on ${day(c.new_start!, tz)} at ${time(c.new_start!, tz)}`;
  }
}

export function changeMessage(changes: ChangeRow[], who: string, tz: string) {
  const lines = changes.slice(0, 3).map((c) => changeLine(c, tz));
  if (changes.length > 3) lines.push(`and ${changes.length - 3} more`);
  return {
    title: changes.length === 1 ? `Schedule change · ${who}` : `${changes.length} schedule changes · ${who}`,
    body: lines.join("\n"),
  };
}
