import { en, type Dictionary } from "./en";

// Keep one translation key per line so locale files stay easy to diff and edit side by side.
export const fr: Dictionary = {
  ...en,
  "locale.label": "Langue",
  "nav.logout": "Déconnexion",
  "auth.login": "Connexion",
  "auth.register": "S’inscrire",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "profile.title": "Profil",
  "users.title": "Utilisateurs",
  "boats.title": "Bateaux",
  "crew.title": "Équipage",
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
