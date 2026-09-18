alter table log_sheets add column source_owner_id text;
alter table log_sheets add column source_sheet_id text;
alter table log_sheets add column source_revision integer;
alter table log_sheets add column copied_at text;
alter table log_sheets add column source_title text;

create index log_sheets_copy_source_idx
  on log_sheets (owner_id, source_owner_id, source_sheet_id);
