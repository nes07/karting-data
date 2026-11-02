import type { Category } from "@/lib/scoring/types";

export interface NamedRef {
  alias: string;
  escuderia: string;
  photo: string | null;
}

export interface ResultFact extends NamedRef {
  pos: number;
  grid: number | null;
  gained: number | null;
  time: number | null;
  pts: number;
  dnf: boolean;
}

export interface FormFact extends NamedRef {
  thisPos: number;
  avgPos: number;
  delta: number;
  racesBefore: number;
}

export interface StandingFact extends NamedRef {
  rank: number;
  pts: number;
  prevRank: number | null;
  prevPts: number | null;
  gapToLeader: number;
}

export interface BattleFact {
  a: string;
  b: string;
  gapBefore: number | null;
  gapAfter: number;
  note: string;
}

export interface VrMove {
  alias: string;
  photo: string | null;
  from: number | null;
  to: number;
  time: number;
  deltaRank: number | null;
}

export interface CatFacts {
  category: Category;
  winner: ResultFact | null;
  podium: ResultFact[];
  results: ResultFact[];
  gainers: ResultFact[];
  losers: ResultFact[];
  formUp: FormFact[];
  formDown: FormFact[];
  drivers: StandingFact[];
  teams: StandingFact[];
  battles: BattleFact[];
  teamBattles: BattleFact[];
}

export interface DebriefFacts {
  raceId: string;
  date: string;
  monthLabel: string;
  roundNumber: number;
  F1: CatFacts;
  F2: CatFacts;
  vr: {
    big: VrMove[];
    small: VrMove[];
  };
}

export interface DebriefSection {
  heading: string;
  paragraphs: string[];
  mentions: string[];
}

export interface DebriefArticle {
  title: string;
  excerpt: string;
  sections: DebriefSection[];
  featured: string[];
}
