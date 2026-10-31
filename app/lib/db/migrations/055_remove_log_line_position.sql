-- Named row locations are remarks; latitude/longitude remain the position.
-- The data-preserving backfill and warning cleanup run in migrations.ts.
alter table log_lines drop column position_name;
