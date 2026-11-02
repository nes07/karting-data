-- Posición de largada (grilla) tomada de la sesión de qualifying.
-- Nullable: carreras antiguas sin datos de quali no muestran Positions Gained.
alter table race_results add column grid_position int;
