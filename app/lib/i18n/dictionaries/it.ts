import { en, type Dictionary } from "./en";

// Keep one translation key per line so locale files stay easy to diff and edit side by side.
export const it: Dictionary = {
  ...en,
  "locale.label": "Lingua",
  "nav.logout": "Esci",
  "auth.login": "Accedi",
  "auth.register": "Registrati",
  "common.cancel": "Annulla",
  "common.save": "Salva",
  "profile.title": "Profilo",
  "users.title": "Utenti",
  "boats.title": "Barche",
  "crew.title": "Equipaggio",
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
