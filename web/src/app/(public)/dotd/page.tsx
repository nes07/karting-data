import type { Metadata } from "next";
import { DotdSection } from "@/components/Sections";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "Driver of the Day | GKD Championship 2026",
  description: "Driver of the Day por fecha del Campeonato GKD",
};

export default async function DotdPage() {
  const site = await getSiteData();
  return <DotdSection entries={site.dotd} />;
}
