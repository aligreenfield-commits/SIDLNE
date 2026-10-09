// sync-calendar: imports a team's iCal feed (TeamSnap, SportsEngine,
// LeagueApps, GameChanger, Google Calendar, ...) into the events table.
//
// Runs with the caller's JWT so Row Level Security applies: a user can only
// sync teams in a household they belong to.
//
// POST { "team_id": "<uuid>" }  ->  { "imported": n, "removed": n }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { parseIcs } from "./ics.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Not signed in" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: auth } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!auth?.user) return json({ error: "Not signed in" }, 401);

  let teamId: string | undefined;
  try {
    teamId = (await req.json())?.team_id;
  } catch {
    // fall through to validation below
  }
  if (!teamId) return json({ error: "team_id is required" }, 400);

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, household_id, athlete_id, calendar_url")
    .eq("id", teamId)
    .maybeSingle();
  if (teamError) return json({ error: teamError.message }, 400);
  if (!team) return json({ error: "Team not found" }, 404);
  if (!team.calendar_url) return json({ error: "This team has no calendar link" }, 400);

  let url: URL;
  try {
    url = new URL(team.calendar_url.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return json({ error: "The calendar link is not a valid URL" }, 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return json({ error: "Calendar links must start with https:// or webcal://" }, 400);
  }

  let text: string;
  try {
    const res = await fetch(url, { headers: { Accept: "text/calendar, text/plain, */*" }, redirect: "follow" });
    if (!res.ok) return json({ error: `The calendar server answered ${res.status}` }, 502);
    text = await res.text();
  } catch (err) {
    return json({ error: `Could not download the calendar: ${(err as Error).message}` }, 502);
  }
  if (text.length > MAX_FEED_BYTES) return json({ error: "That calendar is too large to import" }, 413);
  if (!text.includes("BEGIN:VCALENDAR")) return json({ error: "That link did not return an iCal calendar" }, 422);

  const now = Date.now();
  const from = now - PAST_DAYS * 864e5;
  const to = now + FUTURE_DAYS * 864e5;
  const parsed = parseIcs(text).filter((e) => e.start.getTime() >= from && e.start.getTime() <= to);

  const rows = parsed.map((e) => ({
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
    created_by: auth.user.id,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("events")
      .upsert(rows.slice(i, i + 500), { onConflict: "team_id,external_uid" });
    if (error) return json({ error: error.message }, 400);
  }

  // Remove future imported events that the feed no longer contains (cancellations)
  const keep = new Set(rows.map((r) => r.external_uid));
  const { data: existing } = await supabase
    .from("events")
    .select("id, external_uid")
    .eq("team_id", team.id)
    .eq("source", "ical")
    .gte("start", new Date(now).toISOString());
  const stale = (existing ?? []).filter((e) => !keep.has(e.external_uid)).map((e) => e.id);
  if (stale.length) await supabase.from("events").delete().in("id", stale);

  await supabase.from("teams").update({ last_synced_at: new Date().toISOString() }).eq("id", team.id);

  return json({ imported: rows.length, removed: stale.length });
});
