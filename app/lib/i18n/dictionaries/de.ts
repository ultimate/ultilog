import { en, type Dictionary } from "./en";

// Keep one translation key per line so locale files stay easy to diff and edit side by side.
export const de: Dictionary = {
  ...en,
  "locale.label": "Sprache",
  "nav.logout": "Abmelden",
  "auth.login": "Anmelden",
  "auth.register": "Registrieren",
  "common.cancel": "Abbrechen",
  "common.save": "Speichern",
  "profile.title": "Profil",
  "users.title": "Benutzer",
  "boats.title": "Boote",
  "crew.title": "Crew",
  "details.course.compass": "MgK / CC",
  "details.course.deviation": "Abl / Dev",
  "details.course.magnetic": "mwK / MC",
  "details.course.variation": "Mw / Var",
  "details.course.true": "rwK / TC",
  "details.course.windDrift": "BW / WD",
  "details.course.throughWater": "KdW / CTW",
  "details.course.currentDrift": "BS / CD",
  "details.course.overGround": "KüG / COG",
};
