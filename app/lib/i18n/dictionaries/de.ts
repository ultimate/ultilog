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
};
