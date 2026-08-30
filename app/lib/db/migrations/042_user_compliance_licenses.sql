create table if not exists user_compliance_licenses (
  user_id text not null references users(id) on delete cascade,
  license_id text not null,
  start_date text,
  selected_at text not null default current_timestamp,
  primary key (user_id, license_id)
);

create index if not exists user_compliance_licenses_user_idx
  on user_compliance_licenses (user_id);

insert into user_compliance_licenses (user_id, license_id)
select id, selected_compliance_license_id from users
where selected_compliance_license_id is not null
on conflict (user_id, license_id) do nothing;
