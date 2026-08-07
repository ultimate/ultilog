create table if not exists engines (
  id text primary key,
  boat_id text not null references boats(id) on delete cascade,
  sort_order integer not null,
  name text not null,
  short_label text not null,
  role text not null check (role in ('propulsion', 'generator', 'auxiliary')),
  archived integer not null default 0,
  manufacturer text not null default '',
  model text not null default '',
  serial_number text not null default '',
  unique (boat_id, sort_order)
);

create table if not exists log_line_engine_hours (
  sheet_id text not null,
  line_sort_order integer not null,
  engine_id text not null references engines(id),
  runtime_hours real not null check (runtime_hours >= 0),
  primary key (sheet_id, line_sort_order, engine_id),
  foreign key (sheet_id, line_sort_order) references log_lines(sheet_id, sort_order) on delete cascade
);

insert into engines (id, boat_id, sort_order, name, short_label, role)
select id || ':main-engine', id, 0, 'Main engine', 'Main', 'propulsion' from boats
where not exists (select 1 from engines where engines.boat_id = boats.id);

insert into log_line_engine_hours (sheet_id, line_sort_order, engine_id, runtime_hours)
select log_lines.sheet_id, log_lines.sort_order, engines.id, log_lines.motor_hours
from log_lines
join log_sheets on log_sheets.id = log_lines.sheet_id
join engines on engines.boat_id = log_sheets.boat_id and engines.sort_order = 0
where log_lines.motor_hours > 0
  and not exists (
    select 1 from log_line_engine_hours
    where log_line_engine_hours.sheet_id = log_lines.sheet_id
      and log_line_engine_hours.line_sort_order = log_lines.sort_order
  );

update log_sheets set motor_hours = coalesce((
  select sum(runtime_hours) from log_line_engine_hours where log_line_engine_hours.sheet_id = log_sheets.id
), 0);
