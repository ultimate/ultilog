alter table log_sheets add column motor_miles real not null default 0;
alter table log_sheets add column sail_miles real not null default 0;
alter table log_sheets add column total_miles real not null default 0;
alter table log_sheets add column duration_minutes integer;
alter table log_sheets add column share_privacy text not null default 'private';
alter table log_sheets add column share_master_data integer not null default 0;
alter table log_sheets add column share_picture integer not null default 0;
alter table log_sheets add column share_loglines integer not null default 0;
alter table log_sheets add column share_metrics integer not null default 0;
alter table log_sheets add column share_technical_log integer not null default 0;
alter table log_sheets add column share_skipper integer not null default 0;
alter table log_sheets add column share_crew integer not null default 0;

create index if not exists log_sheets_share_privacy_idx on log_sheets (share_privacy);
create index if not exists log_sheets_total_miles_idx on log_sheets (total_miles);
create index if not exists log_sheets_duration_minutes_idx on log_sheets (duration_minutes);
