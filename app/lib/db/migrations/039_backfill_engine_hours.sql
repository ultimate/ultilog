-- The original multi-engine migration assigned legacy runtime only to the first
-- engine. Copy it to every other known engine without overwriting readings that
-- have already been entered explicitly.
insert into log_line_engine_hours (sheet_id, line_sort_order, engine_id, runtime_hours)
select log_lines.sheet_id, log_lines.sort_order, engines.id, log_lines.motor_hours
from log_lines
join log_sheets on log_sheets.id = log_lines.sheet_id
join engines on engines.boat_id = log_sheets.boat_id
where log_lines.motor_hours > 0
  and not exists (
    select 1 from log_line_engine_hours existing
    where existing.sheet_id = log_lines.sheet_id
      and existing.line_sort_order = log_lines.sort_order
      and existing.engine_id = engines.id
  );

update log_sheets set motor_hours = coalesce((
  select sum(runtime_hours) from log_line_engine_hours where log_line_engine_hours.sheet_id = log_sheets.id
), 0);
