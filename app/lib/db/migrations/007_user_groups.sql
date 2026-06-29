create table if not exists user_groups (
  user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at text not null default current_timestamp,
  primary key (user_id, name)
);

insert into user_groups (user_id, name)
select id, 'demo' from users where email = 'demo@ultilog.local'
on conflict do nothing;

insert into user_groups (user_id, name)
select id, 'admin' from users where email = 'ultimatej@gmx.net'
on conflict do nothing;
