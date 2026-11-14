create table if not exists logbook_turn_state (
  owner_id text primary key references users(id) on delete cascade,
  revision integer not null default 1,
  data text not null
);
