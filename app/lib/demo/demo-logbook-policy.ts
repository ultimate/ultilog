import { defaultLogSheetShareSettings, type PersistedLogbook } from "../../models/logbook";

export function applyDemoLogbookRestrictions(logbook: PersistedLogbook): PersistedLogbook {
  return {
    ...(logbook.turnState ? {turnState: logbook.turnState} : {}),
    boats: logbook.boats.map(({ image: _image, ...boat }) => boat),
    crewMembers: logbook.crewMembers.map(({ image: _image, ...crew }) => crew),
    sheets: logbook.sheets.map(({ image: _image, ...sheet }) => ({
      ...sheet,
      share: { ...defaultLogSheetShareSettings },
      crew: sheet.crew.map(({ image: _crewImage, ...crew }) => crew),
    })),
  };
}
