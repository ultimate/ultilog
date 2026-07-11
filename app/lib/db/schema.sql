create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at text not null default current_timestamp,
  onboarding_completed_tasks text not null default '[]',
  theme text not null default 'light',
  nav_slim integer not null default 0,
  has_read_compliance integer not null default 0,
  country_code text not null default '',
  language text not null default 'en',
  wind_unit text not null default 'bft',
  water_height_unit text not null default 'm',
  temperature_unit text not null default '°C',
  coordinate_format text not null default 'decimal',
  distance_display_unit text not null default 'off',
  default_boat_id text not null default '',
  default_crew_member_ids text not null default '[]',
  show_course_conversion_table integer not null default 1
);

create unique index if not exists users_name_unique_idx on users (lower(name));

create table if not exists user_groups (
  user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at text not null default current_timestamp,
  primary key (user_id, name)
);


create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null default current_timestamp
);

create index if not exists password_reset_tokens_user_id_idx on password_reset_tokens (user_id);
create index if not exists password_reset_tokens_expires_at_idx on password_reset_tokens (expires_at);

create table if not exists boats (
  id text primary key,
  name text not null,
  type text not null,
  registration text not null,
  flag_state text not null,
  home_port text not null,
  owner text not null,
  dimensions text not null,
  yacht_data text not null,
  owner_id text not null default 'legacy-user' references users(id) on delete cascade,
  deviation_table text not null default '[]'
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
  technical_checks text not null,
  owner_id text not null default 'legacy-user' references users(id) on delete cascade,
  source text,
  verification_note text,
  scanner_warnings text
);

create table if not exists crew_members (
  id text primary key,
  name text not null,
  nationality text not null,
  role text not null,
  owner_id text not null default 'legacy-user' references users(id) on delete cascade,
  address text not null default '',
  certificate text not null default '',
  is_primary integer not null default 0
);

create table if not exists sheet_crew_members (
  sheet_id text not null references log_sheets(id) on delete cascade,
  crew_member_id text not null references crew_members(id) on delete cascade,
  sort_order integer not null,
  embarkation text not null,
  disembarkation text not null,
  embarkation_datetime text not null default '',
  embarkation_position text not null default '',
  disembarkation_datetime text not null default '',
  disembarkation_position text not null default '',
  primary key (sheet_id, crew_member_id, sort_order)
);

create table if not exists log_lines (
  sheet_id text not null references log_sheets(id) on delete cascade,
  sort_order integer not null,
  time text not null,
  position_name text not null,
  latitude real not null,
  longitude real not null,
  log_nm real not null,
  compass_course integer not null default 0,
  waves real not null default 0,
  barometer text not null,
  weather text not null,
  weather_remark text not null default '',
  temperature real not null default 0,
  temperature_unit text not null default '°C',
  sails text not null,
  engine text not null,
  wind_direction text not null default '',
  wind_strength real not null default 0,
  wind_unit text not null default 'bft',
  sea_unit text not null default 'm',
  tide real not null default 0,
  tide_unit text not null default 'm',
  moon text not null default '',
  deviation integer not null default 0,
  magnetic_course integer not null default 0,
  variation integer not null default 0,
  true_course integer not null default 0,
  wind_drift integer not null default 0,
  course_through_water integer not null default 0,
  current_drift integer not null default 0,
  course_over_ground integer not null default 0,
  speed_kn real not null default 0,
  sail_miles real not null default 0,
  sail_note text not null default '',
  motor_miles real not null default 0,
  motor_hours real not null default 0,
  motor_note text not null default '',
  remarks text not null,
  primary key (sheet_id, sort_order)
);
