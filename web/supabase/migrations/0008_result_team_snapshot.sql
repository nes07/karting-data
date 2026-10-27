-- Snapshot, per result, of the team whose seat the driver held AT THAT RACE.
-- Team standings attribute points by this column, so replacing a team's
-- pilots mid-season no longer erases the points they already earned.
alter table race_results add column team_id uuid references teams(id);

-- Backfill 1: drivers who still hold a seat in the result's category.
update race_results rr
set team_id = t.id
from teams t
where rr.is_reserve = false
  and rr.team_id is null
  and t.category = rr.category
  and (t.driver1_id = rr.driver_id or t.driver2_id = rr.driver_id);

-- Backfill 2: retired pilots (seats changed after they raced).
-- LEO and FERNANDO were Minardi's original pilots (Abril).
update race_results
set team_id = (select id from teams where escuderia = 'Minardi')
where is_reserve = false and team_id is null
  and driver_id in (select id from drivers where alias in ('LEO', 'FERNANDO'));

-- TOMÁS V held a Brabham seat (Marzo, Abril); JOSÉ IGNACIO M covered
-- Brabham's second seat as oficial in Julio.
update race_results
set team_id = (select id from teams where escuderia = 'Brabham')
where is_reserve = false and team_id is null
  and driver_id in (select id from drivers where alias in ('TOMÁS V', 'JOSÉ IGNACIO M'));
