/** Run once in Supabase → SQL Editor if start_time column is missing. */
export const START_TIME_MIGRATION_SQL = `alter table races
  add column if not exists start_time time not null default '12:00:00';`;

export function isStartTimeSchemaError(message: string): boolean {
  return message.includes("start_time") && message.includes("schema cache");
}

export type RaceDbRow = {
  date: string;
  month_label: string;
  is_official: boolean;
  start_time?: string;
};

export function raceRowWithOptionalStartTime(
  date: string,
  monthLabel: string,
  isOfficial: boolean,
  startTime: string,
  includeStartTime: boolean
): RaceDbRow {
  const row: RaceDbRow = {
    date,
    month_label: monthLabel,
    is_official: isOfficial,
  };
  if (includeStartTime) {
    row.start_time = startTime;
  }
  return row;
}

export function stripStartTime(row: RaceDbRow): Omit<RaceDbRow, "start_time"> {
  const { start_time: _ignored, ...rest } = row;
  return rest;
}
