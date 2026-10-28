// Sorting one shared calendar link (Crossbar, SportsEngine...) between several
// teams of a family. The app mirrors these rules in assets/app.js (sortRules);
// keep the two in step.

export type SortTeam = {
  id: string;
  calendar_url: string | null;
  event_filter?: string | null;
  event_titles?: string[] | null;
  hidden_titles?: string[] | null;
};

// An event name with numbers and punctuation evened out, so "Game 1" and
// "Game 2", or "U12 - Practice" and "U12-Practice", sort the same way
export function normTitle(title: string): string {
  return (title || "").toLowerCase().replace(/\d+/g, "#").replace(/[^a-z#]+/g, " ").trim();
}

// Two teams use the same calendar when their links match apart from the scheme
export function linkKey(url: string | null | undefined): string {
  return String(url || "").trim().replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

// Words separated by commas; matches when the title contains any of them
// (an empty filter matches everything)
export function matchesFilter(filter: string | null | undefined, title: string): boolean {
  const words = (filter ?? "").split(",").map(loose).filter(Boolean);
  const t = ` ${loose(title)} `;
  return !words.length || words.some((w) => t.includes(w));
}

// Lowercase letters and digits only, so odd spacing or punctuation in a team app's
// event names ("Rostered\u00a0Players", "7G-Blue") still matches the family's words
function loose(text: string): string {
  return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Whether an event from the shared link goes on `team`. In order: a name the
// family hid goes nowhere; a name the family put on a team goes only there;
// otherwise the team's words decide. A team with no names and no words takes
// everything when it has the link to itself, and nothing yet when it shares it
// (its events wait to be sorted instead of showing up twice).
export function belongsTo(team: SortTeam, siblings: SortTeam[], title: string): boolean {
  const p = normTitle(title);
  if (siblings.some((s) => s.hidden_titles?.includes(p))) return false;
  const owner = siblings.find((s) => s.event_titles?.includes(p));
  if (owner) return owner.id === team.id;
  if (!team.event_titles?.length && !(team.event_filter ?? "").trim()) return siblings.length <= 1;
  return !!(team.event_filter ?? "").trim() && matchesFilter(team.event_filter, title);
}

// Event names in the link that no team takes and nobody hid
export function unsortedTitles(siblings: SortTeam[], titles: string[], limit = 200): string[] {
  const out = new Set<string>();
  for (const t of titles) {
    const p = normTitle(t);
    if (!p || out.has(p)) continue;
    if (!siblings.some((s) => belongsTo(s, siblings, t)) && !siblings.some((s) => s.hidden_titles?.includes(p))) out.add(p);
    if (out.size >= limit) break;
  }
  return [...out];
}
