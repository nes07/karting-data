"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResumenStudio } from "@/components/ResumenStudio";

function Inner() {
  const search = useSearchParams();
  return <ResumenStudio initialRaceId={search.get("race") ?? undefined} />;
}

export default function AdminResumenPage() {
  return (
    <Suspense fallback={<div className="admin-card">Cargando…</div>}>
      <Inner />
    </Suspense>
  );
}
