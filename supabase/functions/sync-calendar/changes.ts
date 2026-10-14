// Works out which upcoming games and practices changed between the events
// already saved for a team and a fresh copy of its calendar feed.

export type SavedEvent = { id: string; external_uid: string; title: string; start: string; location: string | null };
export type FeedEvent = { external_uid: string; title: string; start: string; location: string | null };
export type Change = {
  kind: "time" | "location" | "cancelled" | "added";
  event_uid: string;
  event_id: string | null;
  title: string;
  old_start: string | null;
  new_start: string | null;
  old_location: string | null;
  new_location: string | null;
};

const ADDED_WINDOW_MS = 14 * 864e5; // only flag new events in the next two weeks
const MAX_CHANGES = 50; // a feed that reshuffles everything shouldn't flood the family

const clean = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ");

export function detectChanges(saved: SavedEvent[], feed: FeedEvent[], now: number): Change[] {
  const before = new Map(saved.map((e) => [e.external_uid, e]));
  const after = new Map(feed.map((e) => [e.external_uid, e]));
  const changes: Change[] = [];

  for (const e of feed) {
    const start = new Date(e.start).getTime();
    const old = before.get(e.external_uid);
    if (!old) {
      if (start >= now && start - now <= ADDED_WINDOW_MS) {
        changes.push({ kind: "added", event_uid: e.external_uid, event_id: null, title: e.title, old_start: null, new_start: e.start, old_location: null, new_location: e.location });
      }
      continue;
    }
    const oldStart = new Date(old.start).getTime();
    if (Math.max(start, oldStart) < now) continue; // already over
    if (Math.abs(start - oldStart) >= 60_000) {
      changes.push({ kind: "time", event_uid: e.external_uid, event_id: old.id, title: e.title, old_start: old.start, new_start: e.start, old_location: old.location, new_location: e.location });
    } else if (clean(old.location) && clean(old.location) !== clean(e.location)) {
      changes.push({ kind: "location", event_uid: e.external_uid, event_id: old.id, title: e.title, old_start: old.start, new_start: e.start, old_location: old.location, new_location: e.location });
    }
  }

  for (const old of saved) {
    if (after.has(old.external_uid) || new Date(old.start).getTime() < now) continue;
    changes.push({ kind: "cancelled", event_uid: old.external_uid, event_id: null, title: old.title, old_start: old.start, new_start: null, old_location: old.location, new_location: null });
  }

  // Soonest first, so the cap keeps the changes that matter most
  const when = (c: Change) => new Date(c.new_start ?? c.old_start ?? 0).getTime();
  return changes.sort((a, b) => when(a) - when(b)).slice(0, MAX_CHANGES);
}
