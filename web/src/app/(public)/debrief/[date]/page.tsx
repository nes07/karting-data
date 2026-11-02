import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DebriefArticleView } from "@/components/DebriefView";
import { loadPublishedDebriefByDate } from "@/lib/debrief/load";
import { getDriverPhotos, getSiteData } from "@/lib/get-site";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ date: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const item = await loadPublishedDebriefByDate(date);
  if (!item) return { title: "Debrief | GKD Championship" };
  return {
    title: `${item.title} | GKD Championship`,
    description: item.excerpt,
  };
}

export default async function DebriefDatePage({ params }: Props) {
  const { date } = await params;
  const item = await loadPublishedDebriefByDate(date);
  if (!item) notFound();
  const site = await getSiteData();
  const photos = getDriverPhotos(site);
  return (
    <section className="section page-shell">
      <div className="container">
        <DebriefArticleView item={item} photos={photos} />
      </div>
    </section>
  );
}
