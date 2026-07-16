alter table log_sheets add column share_privacy text not null default 'private';
alter table log_sheets add column share_master_data integer not null default 0;
alter table log_sheets add column share_picture integer not null default 0;
alter table log_sheets add column share_loglines integer not null default 0;
alter table log_sheets add column share_technical_log integer not null default 0;
alter table log_sheets add column share_skipper integer not null default 0;
alter table log_sheets add column share_crew integer not null default 0;

create index if not exists log_sheets_share_privacy_idx on log_sheets (share_privacy);
