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
  show_course_conversion_table integer not null default 1,
  motion_stationary_threshold_nm real not null default 0.1,
  email_verified_at text
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

create table if not exists email_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null default current_timestamp
);

create index if not exists email_verification_tokens_user_id_idx on email_verification_tokens (user_id);
create index if not exists email_verification_tokens_expires_at_idx on email_verification_tokens (expires_at);

create table if not exists demo_sandboxes (
  user_id text primary key references users(id) on delete cascade,
  template_version integer not null,
  expires_at text not null,
  last_accessed_at text not null,
  created_at text not null default current_timestamp
);

create index if not exists demo_sandboxes_expires_at_idx on demo_sandboxes (expires_at);

create table if not exists demo_login_tokens (
  token_hash text primary key,
  user_id text not null references demo_sandboxes(user_id) on delete cascade,
  expires_at text not null,
  used_at text,
  created_at text not null default current_timestamp
);

create index if not exists demo_login_tokens_expires_at_idx on demo_login_tokens (expires_at);

create table if not exists boats (
  id text primary key,
  archived integer not null default 0,
  name text not null,
  type text not null,
  registration text not null,
  flag_state text not null,
  home_port text not null,
  owner text not null,
  dimensions text not null,
  logfactor real not null default 1,
  yacht_data text not null,
  owner_id text not null references users(id) on delete cascade,
  deviation_table text not null default '[]',
  wind_drift_table text not null default '[]',
  image_data text,
  image_mime_type text,
  image_width integer,
  image_height integer
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
  owner_id text not null references users(id) on delete cascade,
  source text,
  verification_note text,
  scanner_warnings text,
  image_data text,
  image_mime_type text,
  image_width integer,
  image_height integer,
  motor_miles real not null default 0,
  sail_miles real not null default 0,
  total_miles real not null default 0,
  duration_minutes integer,
  motor_hours real not null default 0,
  overall_duration_minutes integer,
  motion_duration_minutes integer not null default 0,
  share_privacy text not null default 'private',
  share_master_data integer not null default 0,
  share_picture integer not null default 0,
  share_loglines integer not null default 0,
  share_metrics integer not null default 0,
  share_technical_log integer not null default 0,
  share_skipper integer not null default 0,
  share_crew integer not null default 0
);

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

create index if not exists log_sheets_share_privacy_idx on log_sheets (share_privacy);
create index if not exists log_sheets_total_miles_idx on log_sheets (total_miles);
create index if not exists log_sheets_duration_minutes_idx on log_sheets (duration_minutes);
create index if not exists log_sheets_overall_duration_minutes_idx on log_sheets (overall_duration_minutes);
create index if not exists log_sheets_motion_duration_minutes_idx on log_sheets (motion_duration_minutes);

create table if not exists crew_members (
  id text primary key,
  name text not null,
  nationality text not null,
  role text not null,
  owner_id text not null references users(id) on delete cascade,
  address text not null default '',
  certificate text not null default '',
  date_of_birth text not null default '',
  place_of_birth text not null default '',
  gender text not null default '',
  identity_document_type text not null default '',
  identity_document_number text not null default '',
  identity_document_issuing_date text not null default '',
  identity_document_expiry_date text not null default '',
  is_primary integer not null default 0,
  image_data text,
  image_mime_type text,
  image_width integer,
  image_height integer
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

create table if not exists log_line_engine_hours (
  sheet_id text not null,
  line_sort_order integer not null,
  engine_id text not null references engines(id),
  runtime_hours real not null check (runtime_hours >= 0),
  primary key (sheet_id, line_sort_order, engine_id),
  foreign key (sheet_id, line_sort_order) references log_lines(sheet_id, sort_order) on delete cascade
);
