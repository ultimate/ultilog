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
