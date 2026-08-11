create table stored_images (
  id text primary key,
  owner_id text not null references users(id) on delete cascade,
  data text not null,
  mime_type text not null,
  width integer not null,
  height integer not null,
  created_at text not null default current_timestamp,
  unique (owner_id, id)
);

create index stored_images_owner_idx on stored_images(owner_id);
alter table boats add column image_id text references stored_images(id) on delete restrict;
alter table crew_members add column image_id text references stored_images(id) on delete restrict;
alter table log_sheets add column image_id text references stored_images(id) on delete restrict;

insert into stored_images (id, owner_id, data, mime_type, width, height)
select id || ':image', owner_id, image_data, image_mime_type, image_width, image_height from boats where image_data is not null;
update boats set image_id = id || ':image' where image_data is not null;

insert into stored_images (id, owner_id, data, mime_type, width, height)
select id || ':image', owner_id, image_data, image_mime_type, image_width, image_height from crew_members where image_data is not null;
update crew_members set image_id = id || ':image' where image_data is not null;

insert into stored_images (id, owner_id, data, mime_type, width, height)
select id || ':image', owner_id, image_data, image_mime_type, image_width, image_height from log_sheets where image_data is not null;
update log_sheets set image_id = id || ':image' where image_data is not null;
