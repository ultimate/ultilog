create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at text not null default current_timestamp
);

insert into users (id, name, email, password_hash)
select 'legacy-user', 'Local demo user', 'demo@ultilog.local', ''
where not exists (select 1 from users where id = 'legacy-user');

alter table boats add column owner_id text not null default 'legacy-user' references users(id) on delete cascade;
alter table log_sheets add column owner_id text not null default 'legacy-user' references users(id) on delete cascade;
alter table crew_members add column owner_id text not null default 'legacy-user' references users(id) on delete cascade;
