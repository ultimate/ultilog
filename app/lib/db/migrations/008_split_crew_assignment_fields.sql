alter table sheet_crew_members add column embarkation_datetime text not null default '';
alter table sheet_crew_members add column embarkation_position text not null default '';
alter table sheet_crew_members add column disembarkation_datetime text not null default '';
alter table sheet_crew_members add column disembarkation_position text not null default '';

update sheet_crew_members
set embarkation_position = embarkation,
    disembarkation_position = disembarkation
where embarkation_position = '' and disembarkation_position = '';
