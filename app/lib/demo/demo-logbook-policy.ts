import { defaultLogSheetShareSettings, type PersistedLogbook } from "../../models/logbook";

export function applyDemoLogbookRestrictions(logbook: PersistedLogbook): PersistedLogbook {
  return {
    boats: logbook.boats.map(({ image: _image, ...boat }) => boat),
    crewMembers: logbook.crewMembers.map(({ image: _image, ...crew }) => crew),
    sheets: logbook.sheets.map(({ image: _image, ...sheet }) => ({
      ...sheet,
      share: { ...defaultLogSheetShareSettings },
      crew: sheet.crew.map(({ image: _crewImage, ...crew }) => crew),
    })),
  };
}
