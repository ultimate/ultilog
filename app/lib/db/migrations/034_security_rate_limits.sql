create table if not exists security_rate_limits (
  scope_key text not null,
  window_start text not null,
  request_count integer not null,
  expires_at text not null,
  primary key (scope_key, window_start)
);

create index if not exists security_rate_limits_expires_at_idx on security_rate_limits (expires_at);

alter table demo_sandboxes add column requester_ip_hash text not null default '';
alter table demo_sandboxes add column requester_device_hash text not null default '';
create index if not exists demo_sandboxes_requester_ip_idx on demo_sandboxes (requester_ip_hash, expires_at);
create index if not exists demo_sandboxes_requester_device_idx on demo_sandboxes (requester_device_hash, expires_at);
