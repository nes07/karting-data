import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DebriefArticleView } from "@/components/DebriefView";
import { loadPublishedDebriefByDate } from "@/lib/debrief/load";
import { getDriverPhotos, getSiteData, getTeamPhotos } from "@/lib/get-site";

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
  return (
    <DebriefArticleView
      item={item}
      photos={getDriverPhotos(site)}
      teamPhotos={getTeamPhotos(site)}
    />
  );
}
