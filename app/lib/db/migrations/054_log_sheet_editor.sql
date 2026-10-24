-- Backend-specific nullable log-line columns are migrated in migrations.ts.
alter table log_sheets add column scanner_warnings_dismissed integer not null default 0;
