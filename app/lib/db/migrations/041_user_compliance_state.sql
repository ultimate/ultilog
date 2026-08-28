alter table users add column selected_compliance_license_id text;

create table if not exists user_compliance_manual_requirements (
  user_id text not null references users(id) on delete cascade,
  license_id text not null,
  requirement_id text not null,
  completed_at text not null default current_timestamp,
  primary key (user_id, license_id, requirement_id)
);

create index if not exists user_compliance_manual_requirements_user_idx
  on user_compliance_manual_requirements (user_id);
