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
const sameEvent = (title: string, start: string) => `${clean(title).toLowerCase()}|${Math.round(new Date(start).getTime() / 60_000)}`;

// Some team apps give an event a new ID every time the calendar is downloaded.
// Pairs a saved event that's missing from the feed with a feed event that has a
// new ID but the same title and start, so it's kept (with its rides) instead of
// being reported as cancelled and re-added on every sync.
export function rematchEvents(saved: SavedEvent[], feed: FeedEvent[]): { id: string; from: string; to: string }[] {
  const savedUids = new Set(saved.map((e) => e.external_uid));
  const feedUids = new Set(feed.map((e) => e.external_uid));
  const fresh = new Map<string, FeedEvent>();
  for (const e of feed) {
    const k = sameEvent(e.title, e.start);
    if (!savedUids.has(e.external_uid) && !fresh.has(k)) fresh.set(k, e);
  }
  const pairs: { id: string; from: string; to: string }[] = [];
  for (const old of saved) {
    if (feedUids.has(old.external_uid)) continue;
    const k = sameEvent(old.title, old.start);
    const match = fresh.get(k);
    if (!match) continue;
    fresh.delete(k);
    pairs.push({ id: old.id, from: old.external_uid, to: match.external_uid });
  }
  return pairs;
}

// Saved events that are extra copies of a game still in the feed: their ID isn't
// in the feed any more, but the same title and start are. Some team apps give
// every event a new ID on each download, which left one copy per sync behind.
export function duplicateIds(saved: SavedEvent[], feed: FeedEvent[]): string[] {
  const feedUids = new Set(feed.map((e) => e.external_uid));
  const inFeed = new Set(feed.map((e) => sameEvent(e.title, e.start)));
  return saved.filter((e) => !feedUids.has(e.external_uid) && inFeed.has(sameEvent(e.title, e.start))).map((e) => e.id);
}

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

  // Safety net: an event "cancelled" and "added" at the same time with the same title didn't change
  const added = new Set(changes.filter((c) => c.kind === "added").map((c) => sameEvent(c.title, c.new_start!)));
  const gone = new Set(changes.filter((c) => c.kind === "cancelled").map((c) => sameEvent(c.title, c.old_start!)));
  const real = changes.filter((c) =>
    !(c.kind === "added" && gone.has(sameEvent(c.title, c.new_start!))) &&
    !(c.kind === "cancelled" && added.has(sameEvent(c.title, c.old_start!))));

  // Soonest first, so the cap keeps the changes that matter most
  const when = (c: Change) => new Date(c.new_start ?? c.old_start ?? 0).getTime();
  return real.sort((a, b) => when(a) - when(b)).slice(0, MAX_CHANGES);
}
