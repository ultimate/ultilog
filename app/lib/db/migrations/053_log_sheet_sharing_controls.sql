alter table log_sheets add column share_remarks text not null default 'private' check (share_remarks in ('private', 'registered', 'public'));

update log_sheets set share_remarks = share_master_data;

update log_sheets set
  share_picture = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_picture = 'public' then 'registered' else share_picture end,
  share_loglines = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_loglines = 'public' then 'registered' else share_loglines end,
  share_metrics = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_metrics = 'public' then 'registered' else share_metrics end,
  share_technical_log = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_technical_log = 'public' then 'registered' else share_technical_log end,
  share_skipper = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_skipper = 'public' then 'registered' else share_skipper end,
  share_crew = case when share_master_data = 'private' then 'private' when share_master_data = 'registered' and share_crew = 'public' then 'registered' else share_crew end,
  share_privacy = share_master_data,
  revision = revision + 1,
  updated_at = current_timestamp;
