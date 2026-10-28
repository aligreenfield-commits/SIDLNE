// sync-calendar: imports a team's iCal feed (TeamSnap, SportsEngine,
// LeagueApps, GameChanger, Google Calendar, ...) into the events table, records
// schedule changes and sends them to the family's phones as push notifications.
//
// From the app: runs with the caller's JWT so Row Level Security applies (a user
// can only sync teams in a household they belong to).
//   POST { "team_id": "<uuid>" }  ->  { "imported": n, "removed": n, "changed": n }
//
// Scheduled (pg_cron, every 15 minutes, see migration 006): checks every team.
//   POST with header x-sync-key  ->  { "checked": n, "changed": n, "failed": n }
//
// Carpool import: reads a shared Google Sheet as CSV for a signed-in user.
//   POST { "sheet_url": "https://docs.google.com/spreadsheets/d/…" }  ->  { "csv": "…" }
//
// Sorting a shared calendar: lists the event names in a link for a signed-in user.
//   POST { "preview_url": "webcal://…" }  ->  { "names": [{ pattern, title, count, next }] }

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { type IcsEvent, parseIcs } from "./ics.ts";
import { detectChanges, duplicateIds, rematchEvents, type SavedEvent } from "./changes.ts";
import { changeMessage, type ChangeRow } from "./notify.ts";
import { apnsConfigured, sendPush } from "./apns.ts";
import { fetchSheetCsv } from "./sheets.ts";
import { belongsTo, linkKey, normTitle, unsortedTitles } from "./sorting.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_FEED_BYTES = 5_000_000;
const PAST_DAYS = 30;
const FUTURE_DAYS = 400;
const SCHEDULED_BATCH = 60; // teams per scheduled run, least recently synced first
const SCHEDULED_FRESH_MS = 10 * 60_000; // skip teams the app synced in the last 10 minutes
const SCHEDULED_BUDGET_MS = 110_000;

type Team = {
  id: string;
  name: string;
  household_id: string;
  athlete_id: string | null;
  calendar_url: string | null;
  last_synced_at: string | null;
  event_filter?: string | null;
  event_titles?: string[] | null;
  hidden_titles?: string[] | null;
  unsorted_titles?: string[] | null;
};
// "*" so the function keeps working before and after a migration adds a column
const TEAM_COLUMNS = "*";

type SyncResult =
  | { ok: true; imported: number; removed: number; changes: ChangeRow[] }
  | { ok: false; error: string; status: number };

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { team_id?: string; sheet_url?: string; preview_url?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // validated below
  }

  const syncKey = req.headers.get("x-sync-key");
  if (syncKey) {
    const db = admin();
    const { data: allowed } = await db.rpc("check_sync_cron_key", { key: syncKey });
    if (allowed !== true) return json({ error: "Not allowed" }, 401);
    return json(await syncAll(db));
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Not signed in" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: auth } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!auth?.user) return json({ error: "Not signed in" }, 401);

  if (body.sheet_url) {
    const sheet = await fetchSheetCsv(body.sheet_url);
    return "csv" in sheet ? json(sheet) : json({ error: sheet.error }, sheet.status);
  }

  if (body.preview_url) {
    const feed = await loadFeed(body.preview_url);
    if ("error" in feed) return json({ error: feed.error }, feed.status);
    return json({ names: eventNames(feed.events) });
  }

  const teamId = body.team_id;
  if (!teamId) return json({ error: "team_id is required" }, 400);

  const { data: team, error: teamError } = await supabase.from("teams").select(TEAM_COLUMNS).eq("id", teamId).maybeSingle();
  if (teamError) return json({ error: teamError.message }, 400);
  if (!team) return json({ error: "Team not found" }, 404);

  const result = await syncTeam(supabase, team as Team, auth.user.id);
  if (!result.ok) return json({ error: result.error }, result.status);
  await notifyFamily(admin(), team as Team, result.changes);
  return json({ imported: result.imported, removed: result.removed, changed: result.changes.length });
});

// Every team with a calendar link, least recently synced first, within a time budget
async function syncAll(db: SupabaseClient) {
  const started = Date.now();
  const { data, error } = await db
    .from("teams")
    .select(TEAM_COLUMNS)
    .not("calendar_url", "is", null)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(SCHEDULED_BATCH);
  if (error) return { error: error.message };
  let checked = 0, changed = 0, failed = 0;
  for (const team of (data ?? []) as Team[]) {
    if (Date.now() - started > SCHEDULED_BUDGET_MS) break;
    if (team.last_synced_at && Date.now() - new Date(team.last_synced_at).getTime() < SCHEDULED_FRESH_MS) continue;
    checked++;
    const result = await syncTeam(db, team, null);
    if (!result.ok) { failed++; continue; }
    changed += result.changes.length;
    await notifyFamily(db, team, result.changes);
  }
  return { checked, changed, failed };
}

async function syncTeam(supabase: SupabaseClient, team: Team, actorId: string | null): Promise<SyncResult> {
  if (!team.calendar_url) return { ok: false, error: "This team has no calendar link", status: 400 };

  // Save the reason on the team so the app can show why a sync failed
  const fail = async (error: string, status: number): Promise<SyncResult> => {
    await supabase.from("teams").update({ last_sync_error: error.slice(0, 300) }).eq("id", team.id);
    return { ok: false, error, status };
  };

  const feed = await loadFeed(team.calendar_url);
  if ("error" in feed) return fail(feed.error, feed.status);
  const parsed = feed.events;
  const now = Date.now();
  const from = now - PAST_DAYS * 864e5;

  // Other teams of the family on the same link (a club calendar shared between
  // kids or sports): the event names the family sorted decide which team gets what
  const { data: family } = await supabase.from("teams").select(TEAM_COLUMNS)
    .eq("household_id", team.household_id).not("calendar_url", "is", null);
  const siblings = ((family ?? []) as Team[]).filter((s) => linkKey(s.calendar_url) === linkKey(team.calendar_url));
  const me = siblings.find((s) => s.id === team.id) ?? team;
  if (!siblings.includes(me)) siblings.push(me);
  const mine = (title: string) => belongsTo(me, siblings, title);

  // A feed can list the same event twice, which would fail the whole import; keep the first
  const byUid = new Map<string, IcsEvent>();
  for (const e of parsed) {
    // Only this team's events when its calendar mixes several kids or sports
    if (!byUid.has(e.uid) && mine(e.summary || "Team event")) byUid.set(e.uid, e);
  }
  const rows = [...byUid.values()].map((e) => ({
    household_id: team.household_id,
    team_id: team.id,
    athlete_id: team.athlete_id,
    title: e.summary.slice(0, 200) || "Team event",
    description: e.description || null,
    location: e.location || null,
    start: e.start.toISOString(),
    end: e.end && e.end >= e.start ? e.end.toISOString() : null,
    source: "ical",
    external_uid: e.uid,
    ...(actorId ? { created_by: actorId } : {}),
  }));

  // Imported events that lost their team (e.g. edited with the team cleared)
  // go back to it, so they're updated in place instead of being copied
  const uids = rows.map((r) => r.external_uid);
  for (let i = 0; i < uids.length; i += 200) {
    await supabase.from("events").update({ team_id: team.id })
      .eq("household_id", team.household_id).is("team_id", null).eq("source", "ical")
      .in("external_uid", uids.slice(i, i + 200));
  }

  // Events already saved for this team in the import window (paged: the API
  // returns at most 1000 rows at a time)
  const all: SavedEvent[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("events")
      .select("id, external_uid, title, start, location")
      .eq("team_id", team.id)
      .eq("source", "ical")
      .gte("start", new Date(from).toISOString())
      .order("start")
      .range(page * 1000, page * 1000 + 999);
    if (error) return fail(error.message, 400);
    all.push(...((data ?? []) as SavedEvent[]));
    if (!data || data.length < 1000) break;
  }

  // Keep events whose ID the team app changed (same title and time) instead of
  // deleting and re-adding them, which would drop their rides and flood alerts
  for (const m of rematchEvents(all, rows)) {
    const { error } = await supabase.from("events").update({ external_uid: m.to }).eq("id", m.id);
    if (error) continue;
    const e = all.find((x) => x.id === m.id);
    if (e) e.external_uid = m.to;
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("events")
      .upsert(rows.slice(i, i + 500), { onConflict: "team_id,external_uid" });
    if (error) return fail(error.message, 400);
  }

  // Remove extra copies of games still in the feed (past or future), and future
  // imported events the feed no longer contains (cancellations)
  const keep = new Set(rows.map((r) => r.external_uid));
  const dupes = new Set(duplicateIds(all, rows));
  // Events now sorted to another team (or hidden) go quietly (they weren't cancelled)
  for (const e of all) if (!mine(e.title)) dupes.add(e.id);
  const saved = all.filter((e) => new Date(e.start).getTime() >= now && !dupes.has(e.id));
  const stale = [...dupes, ...saved.filter((e) => !keep.has(e.external_uid)).map((e) => e.id)];
  for (let i = 0; i < stale.length; i += 200) {
    await supabase.from("events").delete().in("id", stale.slice(i, i + 200));
  }

  // Schedule-change alerts (skipped on a team's first import, when everything is new)
  let recorded: ChangeRow[] = [];
  if (team.last_synced_at) {
    const changes = detectChanges(saved, rows, now);
    const addedUids = changes.filter((c) => c.kind === "added").map((c) => c.event_uid);
    const ids = new Map<string, string>();
    if (addedUids.length) {
      const { data } = await supabase.from("events").select("id, external_uid").eq("team_id", team.id).in("external_uid", addedUids);
      for (const e of data ?? []) ids.set(e.external_uid, e.id);
    }
    if (changes.length) {
      const changeRows = changes.map((c) => ({
        household_id: team.household_id,
        team_id: team.id,
        event_id: c.event_id ?? ids.get(c.event_uid) ?? null,
        kind: c.kind,
        title: c.title,
        old_start: c.old_start,
        new_start: c.new_start,
        old_location: c.old_location,
        new_location: c.new_location,
      }));
      const { error } = await supabase.from("schedule_changes").insert(changeRows);
      if (!error) recorded = changeRows;
    }
  }

  await supabase.from("teams").update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq("id", team.id);

  // Upcoming event names no team on the link takes, so the app can ask the family
  // to sort them instead of dropping them without a word
  if (siblings.length > 1 || me.event_titles?.length || (me.event_filter ?? "").trim()) {
    const unsorted = unsortedTitles(siblings, parsed.filter((e) => e.start.getTime() >= now).map((e) => e.summary || "Team event"));
    const before = [...(me.unsorted_titles ?? [])].sort().join("\n");
    if (unsorted.slice().sort().join("\n") !== before) {
      await supabase.from("teams").update({ unsorted_titles: unsorted }).in("id", siblings.map((s) => s.id));
    }
  } else if (me.unsorted_titles?.length) {
    await supabase.from("teams").update({ unsorted_titles: [] }).eq("id", team.id);
  }

  return { ok: true, imported: rows.length, removed: stale.length, changes: recorded };
}

// Downloads and reads an iCal link, keeping events inside the import window
async function loadFeed(link: string): Promise<{ events: IcsEvent[] } | { error: string; status: number }> {
  let url: URL;
  try {
    url = new URL(link.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return { error: "The calendar link is not a valid URL", status: 400 };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Calendar links must start with https:// or webcal://", status: 400 };
  }

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "Mozilla/5.0 (compatible; SIDLNE calendar sync; +https://sidlne.app)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { error: `The calendar server answered ${res.status}`, status: 502 };
    text = await res.text();
  } catch (err) {
    return { error: `Could not download the calendar: ${(err as Error).message}`, status: 502 };
  }
  if (text.length > MAX_FEED_BYTES) return { error: "That calendar is too large to import", status: 413 };
  if (!text.includes("BEGIN:VCALENDAR")) return { error: "That link did not return an iCal calendar", status: 422 };

  const now = Date.now();
  const from = now - PAST_DAYS * 864e5;
  const to = now + FUTURE_DAYS * 864e5;
  try {
    return { events: parseIcs(text).filter((e) => e.start.getTime() >= from && e.start.getTime() <= to) };
  } catch (err) {
    return { error: `Could not read that calendar: ${(err as Error).message}`, status: 422 };
  }
}

// The distinct event names in a feed, soonest first, for the app's sorting screen
function eventNames(events: IcsEvent[]) {
  const now = Date.now();
  const names = new Map<string, { pattern: string; title: string; count: number; next: string | null; last: number }>();
  for (const e of events) {
    const title = (e.summary || "Team event").slice(0, 200);
    const pattern = normTitle(title);
    if (!pattern) continue;
    const n = names.get(pattern) ?? { pattern, title, count: 0, next: null, last: 0 };
    n.count++;
    const t = e.start.getTime();
    if (t >= now && (!n.next || t < Date.parse(n.next))) { n.next = e.start.toISOString(); n.title = title; }
    n.last = Math.max(n.last, t);
    names.set(pattern, n);
  }
  return [...names.values()]
    .sort((a, b) => (a.next ? Date.parse(a.next) : Infinity) - (b.next ? Date.parse(b.next) : Infinity) || b.last - a.last)
    .slice(0, 300)
    .map(({ last: _last, ...n }) => n);
}

// Push the changes to every phone in the family
async function notifyFamily(db: SupabaseClient, team: Team, changes: ChangeRow[]) {
  if (!changes.length || !apnsConfigured()) return;
  try {
    const { data: members } = await db.from("household_members").select("profile_id").eq("household_id", team.household_id);
    const ids = (members ?? []).map((m) => m.profile_id);
    if (!ids.length) return;
    const { data: devices } = await db.from("push_devices").select("token, time_zone").in("profile_id", ids);
    if (!devices?.length) return;
    let athlete: string | null = null;
    if (team.athlete_id) {
      const { data } = await db.from("athletes").select("name").eq("id", team.athlete_id).maybeSingle();
      athlete = data?.name ?? null;
    }
    const who = athlete ? `${athlete}, ${team.name}` : team.name;
    const first = changes.find((c) => c.event_id && c.kind !== "cancelled");
    const results = await Promise.all(devices.map(async (d) => {
      const msg = changeMessage(changes, who, d.time_zone || "America/New_York");
      const r = await sendPush(d.token, {
        ...msg,
        threadId: `team-${team.id}`,
        data: { sidlne: { kind: "changes", household_id: team.household_id, event_id: changes.length === 1 ? first?.event_id ?? null : null } },
      });
      return [d.token, r] as const;
    }));
    const gone = results.filter(([, r]) => r === "gone").map(([t]) => t);
    if (gone.length) await db.from("push_devices").delete().in("token", gone);
  } catch (err) {
    console.error("Could not send notifications", err);
  }
}
