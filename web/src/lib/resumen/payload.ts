import type { Category } from "@/lib/scoring/types";
import type { CatFacts, DebriefFacts, ResultFact, StandingFact } from "@/lib/debrief/types";

export interface ResumenPayload {
  category: Category;
  date: string;
  monthLabel: string;
  roundNumber: number;
  winner: ResultFact | null;
  podium: ResultFact[];
  results: ResultFact[];
  drivers: StandingFact[];
  teams: StandingFact[];
}

export function buildResumenPayload(
  facts: DebriefFacts,
  category: Category
): ResumenPayload {
  const cat: CatFacts = facts[category];
  return {
    category,
    date: facts.date,
    monthLabel: facts.monthLabel,
    roundNumber: facts.roundNumber,
    winner: cat.winner,
    podium: cat.podium,
    results: cat.results,
    drivers: cat.drivers,
    teams: cat.teams,
  };
}

const CAT: Record<Category, string> = {
  F1: "F1 Moderna",
  F2: "F1 Clásica",
};

function gained(r: ResultFact): string {
  if (r.gained == null || r.gained === 0) return "";
  return r.gained > 0
    ? `, ganó ${r.gained} ${r.gained === 1 ? "puesto" : "puestos"}`
    : `, perdió ${Math.abs(r.gained)}`;
}

/** Short VO script for TTS (~30–45 s of speech). */
export function buildNarration(p: ResumenPayload): string {
  const cat = CAT[p.category];
  const bits: string[] = [
    `Round ${p.roundNumber}. ${p.monthLabel}. ${cat}.`,
  ];
  if (p.winner) {
    bits.push(
      `Gana ${p.winner.alias}, de ${p.winner.escuderia}${gained(p.winner)}.`
    );
  }
  if (p.podium.length >= 3) {
    bits.push(
      `El podio: ${p.podium[0].alias}, ${p.podium[1].alias} y ${p.podium[2].alias}.`
    );
  }
  const hero = p.results
    .filter((r) => (r.gained ?? 0) >= 3)
    .sort((a, b) => (b.gained ?? 0) - (a.gained ?? 0))[0];
  if (hero && hero.alias !== p.winner?.alias) {
    bits.push(
      `La remontada: ${hero.alias}, de la grilla ${hero.grid} al puesto ${hero.pos}.`
    );
  }
  if (p.drivers[0]) {
    bits.push(
      `En el campeonato de pilotos, lidera ${p.drivers[0].alias} con ${p.drivers[0].pts} puntos.`
    );
    if (p.drivers[1]) {
      bits.push(
        `Lo sigue ${p.drivers[1].alias} a ${p.drivers[1].gapToLeader} puntos.`
      );
    }
  }
  if (p.teams[0]) {
    bits.push(
      `En constructores, ${p.teams[0].alias} manda con ${p.teams[0].pts} puntos.`
    );
    if (p.teams[1]) {
      bits.push(
        `Segundo, ${p.teams[1].alias}, a ${p.teams[1].gapToLeader}.`
      );
    }
  }
  bits.push("GKD Championship. New Era 2026.");
  return bits.join(" ");
}
