import { readFile } from "node:fs/promises";
import { join } from "node:path";

let schemaSql: string | undefined;

export async function readSchemaSql() {
  schemaSql ??= await readFile(join(process.cwd(), "app", "lib", "db", "schema.sql"), "utf8");
  return schemaSql;
}
