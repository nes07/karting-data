import { Suspense } from "react";
import { ChampionshipToolbar } from "@/components/ChampionshipToolbar";

export default function CampeonatoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="campeonato-layout">
      <Suspense
        fallback={
          <div className="championship-toolbar" aria-hidden="true" />
        }
      >
        <ChampionshipToolbar />
      </Suspense>
      {children}
    </div>
  );
}
