-- Per-line engine runtime was migrated to log_line_engine_hours in migrations
-- 029 and 039. Keeping a second writable value allowed the representations to disagree.
alter table log_lines drop column motor_hours;
