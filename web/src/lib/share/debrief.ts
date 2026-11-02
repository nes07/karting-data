/**
 * Cover payload for the debrief share image: headline, lede, and the
 * featured drivers. No race table — that stays on the article.
 */

export interface DebriefSharePerson {
  alias: string;
  photo: string;
}

export interface DebriefShare {
  kicker: string;
  dateLabel: string;
  title: string;
  excerpt: string;
  people: DebriefSharePerson[];
}

const MAX_PEOPLE = 8;
const MAX_EXCERPT = 220;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const base = (space > 40 ? cut.slice(0, space) : cut).trimEnd();
  return `${base}…`;
}

function dotDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function buildDebriefShare(input: {
  title: string;
  excerpt: string;
  monthLabel: string;
  date: string;
  aliases: string[];
  photos: Record<string, string | null | undefined>;
}): DebriefShare {
  const seen = new Set<string>();
  const people: DebriefSharePerson[] = [];
  for (const alias of input.aliases) {
    if (!alias || seen.has(alias)) continue;
    seen.add(alias);
    const photo = input.photos[alias];
    if (!photo) continue;
    people.push({ alias, photo });
    if (people.length === MAX_PEOPLE) break;
  }

  const month = input.monthLabel.trim().toUpperCase();
  return {
    kicker: month ? `DEBRIEF · ${month}` : "DEBRIEF",
    dateLabel: dotDate(input.date),
    title: input.title.replace(/\s+/g, " ").trim(),
    excerpt: clip(input.excerpt, MAX_EXCERPT),
    people,
  };
}
