alter table crew_members add column address text not null default '';
alter table crew_members add column certificate text not null default '';
alter table crew_members add column is_primary integer not null default 0;
