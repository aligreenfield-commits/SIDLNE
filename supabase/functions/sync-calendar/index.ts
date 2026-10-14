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

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { type IcsEvent, parseIcs } from "./ics.ts";
import { detectChanges, type SavedEvent } from "./changes.ts";
import { changeMessage, type ChangeRow } from "./notify.ts";
import { apnsConfigured, sendPush } from "./apns.ts";

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
};
const TEAM_COLUMNS = "id, name, household_id, athlete_id, calendar_url, last_synced_at";

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

  let body: { team_id?: string } = {};
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

  let url: URL;
  try {
    url = new URL(team.calendar_url.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return fail("The calendar link is not a valid URL", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return fail("Calendar links must start with https:// or webcal://", 400);
  }

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "Mozilla/5.0 (compatible; SIDLNE calendar sync; +https://sidlne.app)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return fail(`The calendar server answered ${res.status}`, 502);
    text = await res.text();
  } catch (err) {
    return fail(`Could not download the calendar: ${(err as Error).message}`, 502);
  }
  if (text.length > MAX_FEED_BYTES) return fail("That calendar is too large to import", 413);
  if (!text.includes("BEGIN:VCALENDAR")) return fail("That link did not return an iCal calendar", 422);

  const now = Date.now();
  const from = now - PAST_DAYS * 864e5;
  const to = now + FUTURE_DAYS * 864e5;
  let parsed: IcsEvent[];
  try {
    parsed = parseIcs(text).filter((e) => e.start.getTime() >= from && e.start.getTime() <= to);
  } catch (err) {
    return fail(`Could not read that calendar: ${(err as Error).message}`, 422);
  }

  // A feed can list the same event twice, which would fail the whole import; keep the first
  const byUid = new Map<string, IcsEvent>();
  for (const e of parsed) if (!byUid.has(e.uid)) byUid.set(e.uid, e);
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

  // Snapshot of the upcoming events already saved, to spot what changed
  const { data: savedData } = await supabase
    .from("events")
    .select("id, external_uid, title, start, location")
    .eq("team_id", team.id)
    .eq("source", "ical")
    .gte("start", new Date(now).toISOString());
  const saved = (savedData ?? []) as SavedEvent[];

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("events")
      .upsert(rows.slice(i, i + 500), { onConflict: "team_id,external_uid" });
    if (error) return fail(error.message, 400);
  }

  // Remove future imported events that the feed no longer contains (cancellations)
  const keep = new Set(rows.map((r) => r.external_uid));
  const stale = saved.filter((e) => !keep.has(e.external_uid)).map((e) => e.id);
  if (stale.length) await supabase.from("events").delete().in("id", stale);

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

  return { ok: true, imported: rows.length, removed: stale.length, changes: recorded };
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
