// Minimal, dependency-free iCalendar (RFC 5545) parser for team schedules.
// Handles line folding, escaping, TZID / UTC / floating / all-day times,
// and common recurrence rules (DAILY, WEEKLY with BYDAY, MONTHLY, YEARLY
// with COUNT / UNTIL / INTERVAL), EXDATE and RECURRENCE-ID overrides.

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date | null;
};

type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };
type Stamp = { wall: Wall; tz: string | null; utc: boolean; allDay: boolean };
type Prop = { name: string; params: Record<string, string>; value: string };

const MAX_INSTANCES = 500;
const HORIZON_MS = 400 * 864e5;
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // Split on the first ':' that is not inside a quoted parameter value
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) { colon = i; break; }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: rawName.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

// Windows time zone names that some calendar exporters emit
const WINDOWS_TZ: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "AUS Eastern Standard Time": "Australia/Sydney",
};

function normalizeTz(tz: string | undefined): string | null {
  if (!tz) return null;
  const name = WINDOWS_TZ[tz] ?? tz.replace(/^\/+/, "");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return name;
  } catch {
    return null;
  }
}

function parseStamp(prop: Prop, fallbackTz: string | null): Stamp | null {
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const wall = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  const allDay = prop.params.VALUE === "DATE" || m[4] === undefined;
  const utc = m[7] === "Z";
  return { wall, utc, allDay, tz: utc ? null : normalizeTz(prop.params.TZID) ?? fallbackTz };
}

// Offset (ms) of a time zone from UTC at a given instant
function tzOffset(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

function toDate(stamp: Stamp): Date {
  const { y, m, d, h, mi, s } = stamp.wall;
  // All-day events are pinned to noon UTC so they land on the right date everywhere
  if (stamp.allDay) return new Date(Date.UTC(y, m - 1, d, 12));
  const naive = Date.UTC(y, m - 1, d, h, mi, s);
  if (stamp.utc || !stamp.tz) return new Date(naive);
  let guess = naive - tzOffset(naive, stamp.tz);
  guess = naive - tzOffset(guess, stamp.tz);
  return new Date(guess);
}

function addDays(w: Wall, days: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + days));
  return { ...w, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekday(w: Wall): number {
  return new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
}

function wallKey(w: Wall): string {
  return [w.y, w.m, w.d, w.h, w.mi].join("-");
}

function expand(start: Stamp, rrule: string, exdates: Set<string>): Wall[] {
  const rule: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) rule[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = rule.FREQ;
  const interval = Math.max(1, +(rule.INTERVAL ?? 1) || 1);
  const count = rule.COUNT ? +rule.COUNT : Infinity;
  let until = Infinity;
  if (rule.UNTIL) {
    const u = parseStamp({ name: "UNTIL", params: {}, value: rule.UNTIL }, start.tz);
    if (u) until = toDate(u.allDay ? { ...u, allDay: false, wall: { ...u.wall, h: 23, mi: 59, s: 59 } } : u).getTime();
  }
  const horizon = Date.now() + HORIZON_MS;
  const byDay = (rule.BYDAY ?? "").split(",").map((d) => DAY_CODES.indexOf(d.slice(-2))).filter((d) => d >= 0);

  const out: Wall[] = [];
  let emitted = 0;
  const take = (w: Wall): boolean => {
    const t = toDate({ ...start, wall: w }).getTime();
    if (t > until || t > horizon || emitted >= count || out.length >= MAX_INSTANCES) return false;
    emitted++;
    if (!exdates.has(wallKey(w))) out.push(w);
    return true;
  };

  if (freq === "DAILY") {
    for (let w = start.wall; take(w); w = addDays(w, interval));
  } else if (freq === "WEEKLY") {
    const days = byDay.length ? [...byDay].sort() : [weekday(start.wall)];
    let weekStart = addDays(start.wall, -weekday(start.wall));
    outer: for (let guard = 0; guard < 2000; guard++, weekStart = addDays(weekStart, 7 * interval)) {
      for (const d of days) {
        const w = addDays(weekStart, d);
        if (toDate({ ...start, wall: w }) < toDate(start)) continue;
        if (!take(w)) break outer;
      }
    }
  } else if (freq === "MONTHLY" || freq === "YEARLY") {
    const step = freq === "MONTHLY" ? interval : 12 * interval;
    for (let i = 0; i < 2000; i++) {
      const months = start.wall.m - 1 + i * step;
      const w = { ...start.wall, y: start.wall.y + Math.floor(months / 12), m: (months % 12) + 1 };
      if (new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDate() !== w.d) continue; // e.g. Feb 30
      if (!take(w)) break;
    }
  } else {
    take(start.wall);
  }
  return out;
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text);
  let calendarTz: string | null = null;
  const blocks: Prop[][] = [];
  let current: Prop[] | null = null;
  let depth = 0; // nested components inside VEVENT (e.g. VALARM)

  for (const line of lines) {
    if (!line) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    if (prop.name === "X-WR-TIMEZONE") calendarTz = normalizeTz(prop.value.trim());
    if (prop.name === "BEGIN" && prop.value.toUpperCase() === "VEVENT") { current = []; depth = 0; continue; }
    if (!current) continue;
    if (prop.name === "BEGIN") { depth++; continue; }
    if (prop.name === "END") {
      if (depth > 0) { depth--; continue; }
      if (prop.value.toUpperCase() === "VEVENT") { blocks.push(current); current = null; }
      continue;
    }
    if (depth === 0) current.push(prop);
  }

  const masters: IcsEvent[] = [];
  const overrides = new Map<string, IcsEvent>(); // key: uid + original start
  const cancelled = new Set<string>();

  for (const props of blocks) {
    const get = (n: string) => props.find((p) => p.name === n);
    const dtstart = get("DTSTART");
    const start = dtstart && parseStamp(dtstart, calendarTz);
    if (!start) continue;

    const uid = get("UID")?.value.trim() || `${get("SUMMARY")?.value}-${dtstart!.value}`;
    const status = get("STATUS")?.value.trim().toUpperCase();
    const dtend = get("DTEND");
    const end = dtend ? parseStamp(dtend, calendarTz) : null;
    const durationMs = parseDuration(get("DURATION")?.value);
    const startDate = toDate(start);
    const base = {
      summary: unescapeText(get("SUMMARY")?.value ?? ""),
      description: unescapeText(get("DESCRIPTION")?.value ?? ""),
      location: unescapeText(get("LOCATION")?.value ?? ""),
    };
    const length = end ? toDate(end).getTime() - startDate.getTime() : durationMs;

    const recurrenceId = get("RECURRENCE-ID");
    if (recurrenceId) {
      const rid = parseStamp(recurrenceId, calendarTz);
      if (!rid) continue;
      const key = `${uid}|${toDate(rid).getTime()}`;
      if (status === "CANCELLED") cancelled.add(key);
      else overrides.set(key, { ...base, uid: `${uid}|${toDate(rid).toISOString()}`, start: startDate, end: length != null ? new Date(startDate.getTime() + length) : null });
      continue;
    }
    if (status === "CANCELLED") continue;

    const rrule = get("RRULE")?.value;
    if (!rrule) {
      masters.push({ ...base, uid, start: startDate, end: length != null ? new Date(startDate.getTime() + length) : null });
      continue;
    }

    const exdates = new Set<string>();
    for (const p of props.filter((p) => p.name === "EXDATE")) {
      for (const v of p.value.split(",")) {
        const ex = parseStamp({ ...p, value: v }, start.tz ?? calendarTz);
        if (!ex) continue;
        // Compare in the series' own wall time
        const exDate = toDate(ex);
        const wall = start.tz && !start.allDay ? wallIn(exDate, start.tz) : ex.wall;
        exdates.add(wallKey(start.allDay ? { ...wall, h: 0, mi: 0 } : wall));
      }
    }
    for (const w of expand(start, rrule, exdates)) {
      const s = toDate({ ...start, wall: w });
      masters.push({ ...base, uid: `${uid}|${s.toISOString()}`, start: s, end: length != null ? new Date(s.getTime() + length) : null });
    }
  }

  // Apply overrides / cancellations to recurring instances
  const result: IcsEvent[] = [];
  const used = new Set<string>();
  for (const e of masters) {
    const [uid, iso] = e.uid.split("|");
    if (iso) {
      const key = `${uid}|${new Date(iso).getTime()}`;
      if (cancelled.has(key)) continue;
      const o = overrides.get(key);
      if (o) { result.push(o); used.add(key); continue; }
    }
    result.push(e);
  }
  for (const [key, o] of overrides) if (!used.has(key)) result.push(o);
  return result;
}

function wallIn(date: Date, tz: string): Wall {
  const shifted = new Date(date.getTime() + tzOffset(date.getTime(), tz));
  return {
    y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
    h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(), s: shifted.getUTCSeconds(),
  };
}

function parseDuration(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}
