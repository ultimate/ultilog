import { encryptCrewField, isCrewEncryptionEnvelope } from "../crypto/crew-encryption";
import type { QueryableDatabase } from "./logbook-database";

const CREW_ENCRYPTED_FIELDS = ["name", "role", "address", "nationality", "certificate"] as const;

type CrewEncryptedField = (typeof CREW_ENCRYPTED_FIELDS)[number];

type CrewMemberBackfillRow = Record<CrewEncryptedField, string | null> & {
  id: string;
  owner_id: string;
};

export async function backfillCrewMemberEncryption(db: QueryableDatabase) {
  const { rows } = await db.query<CrewMemberBackfillRow>(`
    select id, owner_id, name, role, address, nationality, certificate
    from crew_members
  `);

  for (const row of rows) {
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of CREW_ENCRYPTED_FIELDS) {
      const value = row[field] ?? "";
      if (isCrewEncryptionEnvelope(value)) continue;

      values.push(encryptCrewField(row.owner_id, row.id, field, value));
      updates.push(`${field} = ${db.placeholder(values.length)}`);
    }

    if (!updates.length) continue;

    values.push(row.id);
    await db.query(`update crew_members set ${updates.join(", ")} where id = ${db.placeholder(values.length)}`, values);
  }
}
