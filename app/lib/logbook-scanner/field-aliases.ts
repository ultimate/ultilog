import type { Locale } from "../i18n/translations";
import type { LineForm } from "../../models/logbook-forms";

export type ScannerField = keyof LineForm;
export type ScannerFieldAliases = Readonly<Record<Locale, readonly string[]>>;

/**
 * Printed nautical terminology used to associate a sheet column with the
 * canonical, language-neutral log-line field. This intentionally stays
 * separate from UI translations: scanner terminology also includes common
 * abbreviations and wording found on third-party log sheets.
 */
export const scannerFieldAliases = {
  time: aliases(["Time", "Date/time", "UTC", "LT"], ["Zeit", "Datum/Zeit", "Bordzeit", "BZ"], ["Heure", "Date/heure", "TU", "UTC"], ["Ora", "Data/ora", "UTC", "Ora bordo"]),
  position: aliases(["Position", "Pos.", "Waypoint", "Place"], ["Position", "Pos.", "Wegpunkt", "Ort"], ["Position", "Pos.", "Point de route", "Lieu"], ["Posizione", "Pos.", "Punto nave", "Luogo"]),
  latitude: aliases(["Latitude", "Lat.", "Lat"], ["Breite", "Breitengrad", "Lat.", "Lat"], ["Latitude", "Lat.", "Lat"], ["Latitudine", "Lat.", "Lat"]),
  longitude: aliases(["Longitude", "Lon.", "Long."], ["Länge", "Längengrad", "Lon.", "Long."], ["Longitude", "Lon.", "Long."], ["Longitudine", "Lon.", "Long."]),
  weather: aliases(["Weather", "Wx", "Conditions"], ["Wetter", "Wtr.", "Wetterlage"], ["Météo", "Temps", "Conditions"], ["Meteo", "Tempo", "Condizioni"]),
  weatherRemark: aliases(["Weather remarks", "Visibility", "Horizon"], ["Wetterbemerkung", "Sicht", "Horizont"], ["Observations météo", "Visibilité", "Horizon"], ["Note meteo", "Visibilità", "Orizzonte"]),
  temperature: aliases(["Temperature", "Temp.", "Air temp."], ["Temperatur", "Temp.", "Lufttemperatur"], ["Température", "Temp.", "Temp. air"], ["Temperatura", "Temp.", "Temp. aria"]),
  temperatureUnit: aliases(["Temperature unit", "°C/°F"], ["Temperatureinheit", "°C/°F"], ["Unité de température", "°C/°F"], ["Unità temperatura", "°C/°F"]),
  barometer: aliases(["Barometer", "Baro", "Pressure", "hPa"], ["Barometer", "Luftdruck", "Druck", "hPa"], ["Baromètre", "Pression", "hPa"], ["Barometro", "Pressione", "hPa"]),
  windDirection: aliases(["Wind direction", "Wind dir.", "Dir."], ["Windrichtung", "Wind-Rtg.", "Richtung"], ["Direction du vent", "Dir. vent", "Direction"], ["Direzione vento", "Dir. vento", "Direzione"]),
  windStrength: aliases(["Wind strength", "Wind speed", "Force"], ["Windstärke", "Windgeschwindigkeit", "Stärke"], ["Force du vent", "Vitesse du vent", "Force"], ["Forza vento", "Velocità vento", "Forza"]),
  windUnit: aliases(["Wind unit", "Bft", "kn", "kt"], ["Windeinheit", "Bft", "kn", "kt"], ["Unité du vent", "Bft", "nd", "kt"], ["Unità vento", "Bft", "kn", "kt"]),
  waves: aliases(["Waves", "Wave height", "Sea state", "Sea"], ["Wellen", "Wellenhöhe", "Seegang", "See"], ["Vagues", "Hauteur des vagues", "État de la mer", "Mer"], ["Onde", "Altezza onde", "Stato del mare", "Mare"]),
  seaUnit: aliases(["Sea unit", "Wave unit", "m/ft"], ["Seegangseinheit", "Welleneinheit", "m/ft"], ["Unité de houle", "Unité des vagues", "m/ft"], ["Unità onde", "Unità mare", "m/ft"]),
  tide: aliases(["Tide", "Tidal height", "Water level"], ["Gezeit", "Tide", "Wasserstand"], ["Marée", "Hauteur de marée", "Niveau d'eau"], ["Marea", "Altezza marea", "Livello acqua"]),
  tideUnit: aliases(["Tide unit", "Water-level unit", "m/ft"], ["Tideeinheit", "Wasserstandseinheit", "m/ft"], ["Unité de marée", "Unité du niveau d'eau", "m/ft"], ["Unità marea", "Unità livello acqua", "m/ft"]),
  moon: aliases(["Moon", "Moon phase"], ["Mond", "Mondphase"], ["Lune", "Phase lunaire"], ["Luna", "Fase lunare"]),
  compassCourse: aliases(["Compass course", "Compass heading", "CC"], ["Magnetkompass-Kurs", "Kompasskurs", "MgK", "MgK / Cc"], ["Cap compas", "Route compas", "Cc"], ["Prora bussola", "Rotta bussola", "Pb"]),
  deviation: aliases(["Deviation", "Dev"], ["Ablenkung", "Deviation", "Abl", "Abl / d"], ["Déviation", "Dev", "Dév"], ["Deviazione", "Dev"]),
  magneticCourse: aliases(["Magnetic course", "Magnetic heading", "MC"], ["missweisender Kurs", "magnetischer Kurs", "mwK", "mwK / Cm"], ["Cap magnétique", "Route magnétique", "Cm"], ["Prora magnetica", "Rotta magnetica", "Pm"]),
  variation: aliases(["Variation", "Magnetic variation", "Var"], ["Missweisung", "magnetische Missweisung", "Mw", "Mw / D"], ["Déclinaison", "Déclinaison magnétique", "Var"], ["Declinazione", "Declinazione magnetica", "Var"]),
  trueCourse: aliases(["True course", "True heading", "TC"], ["rechtweisender Kurs", "wahrer Kurs", "rwK", "rwK / Cv"], ["Cap vrai", "Route vraie", "Cv"], ["Prora vera", "Rotta vera", "Pv"]),
  windDrift: aliases(["Wind drift", "Leeway", "WD"], ["Beschickung durch Wind", "Windabdrift", "BW"], ["Dérive due au vent", "Dérive au vent", "Dv"], ["Scarroccio", "Deriva vento", "Sc"]),
  courseThroughWater: aliases(["Course through water", "Water track", "CTW"], ["Kurs durchs Wasser", "KdW"], ["Route surface", "Cap surface", "Rs"], ["Rotta sull'acqua", "Rotta di superficie", "RA"]),
  currentDrift: aliases(["Current drift", "Current correction", "CD"], ["Beschickung durch Strom", "Stromabdrift", "BS"], ["Dérive due au courant", "Correction de courant", "Dc"], ["Deriva di corrente", "Correzione corrente", "Dc"]),
  courseOverGround: aliases(["Course over ground", "Ground track", "COG"], ["Kurs über Grund", "KüG", "Kurs ü. G."], ["Route fond", "Route sur le fond", "COG"], ["Rotta sul fondo", "Rotta rispetto al fondo", "COG"]),
  speedKn: aliases(["Speed", "Speed over ground", "Spd", "SOG", "kn"], ["Fahrt", "Geschwindigkeit", "FüG", "F [kn]", "Fahrt [kn]", "kn"], ["Vitesse", "Vitesse fond", "Vit.", "SOG", "nd"], ["Velocità", "Velocità sul fondo", "Vel.", "SOG", "kn"]),
  logNm: aliases(["Log", "Log distance", "Distance log", "nm"], ["Logge", "Loggestand", "Distanz", "sm"], ["Loch", "Distance loch", "Distance", "nm"], ["Solcometro", "Distanza log", "Distanza", "nm"]),
  sailMiles: aliases(["Sail miles", "Sailing distance", "Sail nm"], ["Segelmeilen", "Strecke unter Segel", "Segel sm"], ["Milles sous voile", "Distance à la voile", "Voile nm"], ["Miglia a vela", "Distanza a vela", "Vela nm"]),
  sailNote: aliases(["Sail", "Sail plan", "Sail note"], ["Segel", "Besegelung", "Segelbemerkung"], ["Voilure", "Plan de voilure", "Note voile"], ["Vele", "Piano velico", "Nota vele"]),
  motorMiles: aliases(["Motor miles", "Engine distance", "Motor nm"], ["Motormeilen", "Strecke unter Motor", "Motor sm"], ["Milles moteur", "Distance au moteur", "Moteur nm"], ["Miglia a motore", "Distanza a motore", "Motore nm"]),
  motorHours: aliases(["Engine hours", "Motor hours", "Eng. h"], ["Motorstunden", "Betriebsstunden", "Mot. h"], ["Heures moteur", "Temps moteur", "Mot. h"], ["Ore motore", "Tempo motore", "Mot. h"]),
  motorNote: aliases(["Motor", "Engine note", "Motor note"], ["Motor", "Motorbemerkung", "Maschinennotiz"], ["Moteur", "Note moteur", "Observation moteur"], ["Motore", "Nota motore", "Osservazione motore"]),
  remarks: aliases(["Remarks", "Notes", "Events"], ["Bemerkungen", "Notizen", "Ereignisse"], ["Remarques", "Notes", "Événements"], ["Osservazioni", "Note", "Eventi"]),
} as const satisfies Readonly<Record<ScannerField, ScannerFieldAliases>>;

export const criticalCourseScannerFields = [
  "compassCourse",
  "deviation",
  "magneticCourse",
  "variation",
  "trueCourse",
  "windDrift",
  "courseThroughWater",
  "currentDrift",
  "courseOverGround",
] as const satisfies readonly ScannerField[];

function aliases(en: readonly string[], de: readonly string[], fr: readonly string[], it: readonly string[]): ScannerFieldAliases {
  return { en, de, fr, it };
}
