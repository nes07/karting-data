"use client";

import { useState } from "react";
import {
  DriversTable,
  PodiumDriver,
  PodiumTeam,
  TeamsTable,
  VueltaRapidaTable,
} from "./standings-widgets";
import { DriverStandingRow, TeamStandingRow } from "@/lib/scoring/types";
import { VueltaRapidaRow } from "@/lib/data";

interface Props {
  driversF1: DriverStandingRow[];
  driversF2: DriverStandingRow[];
  teamsF1: TeamStandingRow[];
  teamsF2: TeamStandingRow[];
  vueltaRapida: VueltaRapidaRow[];
  months: string[];
  photos: Record<string, string>;
  teamPhotos: Record<string, string>;
}

const TABS = [
  ["ds-f1", "Drivers — F1"],
  ["ds-f2", "Drivers — F2"],
  ["ts-f1", "Teams — F1"],
  ["ts-f2", "Teams — F2"],
  ["vr", "Vuelta Rápida"],
] as const;

/** @deprecated Use dedicated standings pages instead. Kept for backward compatibility. */
export function StandingsTabs(props: Props) {
  const [active, setActive] = useState<(typeof TABS)[number][0]>("ds-f1");
  const { months } = props;

  return (
    <div className="tabs-wrapper">
      <div className="tabs-nav" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn${active === id ? " active" : ""}`}
            role="tab"
            onClick={() => setActive(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {active === "ds-f1" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumDriver rows={props.driversF1} photos={props.photos} />
          <DriversTable rows={props.driversF1} months={months} />
        </div>
      )}
      {active === "ds-f2" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumDriver rows={props.driversF2} photos={props.photos} />
          <DriversTable rows={props.driversF2} months={months} />
        </div>
      )}
      {active === "ts-f1" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumTeam rows={props.teamsF1} teamPhotos={props.teamPhotos} />
          <TeamsTable rows={props.teamsF1} months={months} />
        </div>
      )}
      {active === "ts-f2" && (
        <div className="tab-panel active" role="tabpanel">
          <PodiumTeam rows={props.teamsF2} teamPhotos={props.teamPhotos} />
          <TeamsTable rows={props.teamsF2} months={months} />
        </div>
      )}
      {active === "vr" && (
        <div className="tab-panel active" role="tabpanel">
          <VueltaRapidaTable rows={props.vueltaRapida} />
        </div>
      )}
    </div>
  );
}
