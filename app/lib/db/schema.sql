create table if not exists boats (
  id text primary key,
  name text not null,
  type text not null,
  registration text not null,
  flag_state text not null,
  home_port text not null,
  owner text not null,
  dimensions text not null,
  yacht_data text not null
);

create table if not exists log_sheets (
  id text primary key,
  title text not null,
  date_range text not null,
  status text not null,
  boat_id text not null references boats(id) on delete cascade,
  skipper text not null,
  route text not null,
  weather_briefing text not null,
  day_summary text not null,
  remarks text not null,
  watch_plan text not null,
  technical_checks text not null
);

create table if not exists crew_members (
  sheet_id text not null references log_sheets(id) on delete cascade,
  sort_order integer not null,
  name text not null,
  nationality text not null,
  role text not null,
  embarkation text not null,
  disembarkation text not null,
  primary key (sheet_id, sort_order)
);

create table if not exists log_lines (
  sheet_id text not null references log_sheets(id) on delete cascade,
  sort_order integer not null,
  time text not null,
  position_name text not null,
  latitude real not null,
  longitude real not null,
  log_nm real not null,
  course text not null,
  magnetic_course text not null,
  sea_state text not null,
  barometer text not null,
  wind text not null,
  weather text not null,
  sails text not null,
  engine text not null,
  remarks text not null,
  primary key (sheet_id, sort_order)
);
