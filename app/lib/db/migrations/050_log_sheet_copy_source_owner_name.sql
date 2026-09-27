alter table log_sheets add column source_owner_name text;

update log_sheets
set source_owner_name = coalesce(
  (select users.name from users where users.id = log_sheets.source_owner_id),
  source_owner_id
)
where source_owner_id is not null;
