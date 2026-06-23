import type { Metadata } from "next";
import { TrazadoSection } from "@/components/Sections";

export const metadata: Metadata = {
  title: "Trazado | GKD Championship 2026",
  description: "Trazado #02-2026 del circuito GKD",
};

export default function TrazadoPage() {
  return <TrazadoSection />;
}
