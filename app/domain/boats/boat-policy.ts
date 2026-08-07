import type { Boat, PersistedLogbook } from "../../models/logbook";

export function activeBoats(boats: Boat[]) {
  return boats.filter((boat) => !boat.archived);
}

export type LogbookMutationError = {
  code: "referenced_boat_deleted" | "missing_boat" | "archived_boat_for_new_sheet";
  message: string;
};

export function validateLogbookMutation(
  current: PersistedLogbook,
  next: PersistedLogbook,
): LogbookMutationError | undefined {
  const nextBoats = new Map(next.boats.map((boat) => [boat.id, boat]));
  const currentSheets = new Map(current.sheets.map((sheet) => [sheet.id, sheet]));

  for (const boat of current.boats) {
    if (nextBoats.has(boat.id)) continue;
    const referencedSheets = current.sheets.filter((sheet) => sheet.boatId === boat.id);
    const replacement = next.boats.find((candidate) =>
      candidate.name === boat.name && candidate.registration === boat.registration,
    );
    const isIdNormalization = replacement && referencedSheets.every((sheet) =>
      next.sheets.some((candidate) =>
        candidate.boatId === replacement.id
        && candidate.title === sheet.title
        && candidate.dateRange === sheet.dateRange
        && candidate.route.from === sheet.route.from
        && candidate.route.to === sheet.route.to,
      ),
    );
    if (referencedSheets.length && !isIdNormalization) {
      return {
        code: "referenced_boat_deleted",
        message: `Boat "${boat.name}" cannot be deleted while it is used by a logsheet.`,
      };
    }
  }

  for (const sheet of next.sheets) {
    const boat = nextBoats.get(sheet.boatId);
    if (!boat) {
      return { code: "missing_boat", message: `Logsheet "${sheet.title}" references a missing boat.` };
    }
    const priorSheet = currentSheets.get(sheet.id);
    const normalizedPriorSheet = current.sheets.find((candidate) => {
      const priorBoat = current.boats.find((candidateBoat) => candidateBoat.id === candidate.boatId);
      return priorBoat?.name === boat.name
        && priorBoat.registration === boat.registration
        && candidate.title === sheet.title
        && candidate.dateRange === sheet.dateRange
        && candidate.route.from === sheet.route.from
        && candidate.route.to === sheet.route.to;
    });
    if (boat.archived && ((!priorSheet || priorSheet.boatId !== sheet.boatId) && !normalizedPriorSheet)) {
      return {
        code: "archived_boat_for_new_sheet",
        message: `Archived boat "${boat.name}" cannot be selected for a new logsheet.`,
      };
    }
  }
}
