alter table log_sheets add column share_privacy text not null default 'private';
alter table log_sheets add column share_master_data text not null default 'private';
alter table log_sheets add column share_picture text not null default 'private';
alter table log_sheets add column share_loglines text not null default 'private';
alter table log_sheets add column share_technical_log text not null default 'private';
alter table log_sheets add column share_skipper text not null default 'private';
alter table log_sheets add column share_crew text not null default 'private';

create index if not exists log_sheets_share_privacy_idx on log_sheets (share_privacy);
