/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { PublishedDebrief } from "@/lib/debrief/load";
import { formatLongDate } from "./format";

export function DebriefPhotoStrip({
  aliases,
  photos,
}: {
  aliases: string[];
  photos: Record<string, string>;
}) {
  const shown = aliases.filter((a) => photos[a]).slice(0, 8);
  if (!shown.length) return null;
  return (
    <div className="debrief-photos">
      {shown.map((alias) => (
        <figure key={alias} className="debrief-photo">
          <img src={photos[alias]} alt={alias} />
          <figcaption>{alias}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function DebriefCard({ item }: { item: PublishedDebrief }) {
  return (
    <Link href={`/debrief/${item.date}`} className="debrief-card">
      <span className="tag">{item.monthLabel}</span>
      <h2>{item.title}</h2>
      <p>{item.excerpt}</p>
      <span className="debrief-card-date">{formatLongDate(item.date)}</span>
    </Link>
  );
}

export function DebriefArticleView({
  item,
  photos,
}: {
  item: PublishedDebrief;
  photos: Record<string, string>;
}) {
  const mentions = [
    ...item.featured,
    ...item.body.sections.flatMap((s) => s.mentions),
  ];
  const unique = [...new Set(mentions)];
  return (
    <article className="debrief-article">
      <p className="debrief-kicker">
        <Link href="/debrief">Debrief</Link>
        {" · "}
        {item.monthLabel} · {formatLongDate(item.date)}
      </p>
      <h1>{item.title}</h1>
      {item.excerpt && <p className="debrief-lede">{item.excerpt}</p>}
      <DebriefPhotoStrip aliases={unique} photos={photos} />
      {item.body.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
