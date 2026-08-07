alter table users add column date_format text not null default 'dd/MM/yyyy';
alter table users add column time_format text not null default 'HH:mm';
