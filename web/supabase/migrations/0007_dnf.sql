-- DNF (did not finish): the driver started the race but didn't complete it.
-- They keep the participation point (and team attendance) but earn no
-- position points; their position that race doesn't count toward posProm.
alter table race_results add column is_dnf boolean not null default false;
