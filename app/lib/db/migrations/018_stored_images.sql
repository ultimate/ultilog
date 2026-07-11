alter table boats add column image_data text;
alter table boats add column image_mime_type text;
alter table boats add column image_width integer;
alter table boats add column image_height integer;

alter table crew_members add column image_data text;
alter table crew_members add column image_mime_type text;
alter table crew_members add column image_width integer;
alter table crew_members add column image_height integer;

alter table log_sheets add column image_data text;
alter table log_sheets add column image_mime_type text;
alter table log_sheets add column image_width integer;
alter table log_sheets add column image_height integer;
