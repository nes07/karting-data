import type { Metadata } from "next";
import { HomeDashboard } from "@/components/HomeDashboard";
import { getSiteData } from "@/lib/get-site";

export const metadata: Metadata = {
  title: "GKD Championship 2026",
  description: "Dashboard del Campeonato GKD — standings, resultados, pilotos y más",
};

export default async function HomePage() {
  const site = await getSiteData();
  return <HomeDashboard site={site} />;
}
