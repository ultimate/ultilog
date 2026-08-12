alter table log_lines add column id text;

-- The former primary key makes (sheet_id, sort_order) unique. Deriving the
-- identifier from that pre-migration identity is deterministic and leaves the
-- current presentation order untouched.
update log_lines
set id = 'line-' || cast(sort_order as text)
where id is null;

create unique index log_lines_sheet_id_id_unique on log_lines (sheet_id, id);
