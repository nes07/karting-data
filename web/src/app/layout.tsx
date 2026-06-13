import type { Metadata, Viewport } from "next";
import "./gkd.css";

export const metadata: Metadata = {
  title: "GKD Championship 2026",
  description:
    "Campeonato GKD 2026 — Standings, tiempos, equipos y Driver of the Day",
  openGraph: {
    title: "GKD Championship 2026",
    description: "Standings, tiempos, equipos y más del Campeonato GKD 2026",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
