// @mentions in carpool chat: "@Ganis running late" alerts the Ganis parent's phone.
// "@all" or "@everyone" alerts every parent in the carpool.

export type Member = { name: string; profile_id: string | null };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Members named in the text. A name matches after "@" when it ends at a word
// boundary, so "@Ganis's" and "@Ganis," count but "@Ganisx" doesn't. Longer
// names win, so "@Ali Greenfield" isn't read as a member called "Ali".
export function findMentions(text: string, members: Member[]): Member[] {
  const lower = norm(text);
  if (/(^|\s)@(all|everyone)\b/.test(lower)) return members;
  const found: Member[] = [];
  const taken: Array<[number, number]> = [];
  const byLength = [...members].sort((a, b) => norm(b.name).length - norm(a.name).length);
  for (const m of byLength) {
    const name = norm(m.name);
    if (!name) continue;
    let at = lower.indexOf(`@${name}`);
    while (at !== -1) {
      const end = at + name.length + 1;
      const next = lower[end] ?? "";
      const free = !taken.some(([s, e]) => at < e && end > s);
      if (!/[a-z0-9]/.test(next) && free) {
        found.push(m);
        taken.push([at, end]);
        break;
      }
      at = lower.indexOf(`@${name}`, at + 1);
    }
  }
  return found;
}
