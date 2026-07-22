alter table log_sheets add column motor_hours real not null default 0;
alter table log_sheets add column overall_duration_minutes integer;
alter table log_sheets add column motion_duration_minutes integer not null default 0;

create index if not exists log_sheets_overall_duration_minutes_idx on log_sheets (overall_duration_minutes);
create index if not exists log_sheets_motion_duration_minutes_idx on log_sheets (motion_duration_minutes);
