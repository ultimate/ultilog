export const scannerWeatherEmojis = [
  "☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️", "🌨️", "🌩️", "🌪️", "🌫️", "☀️", "❄️", "⭐",
] as const;

const canonicalEmoji = new Map(
  scannerWeatherEmojis.flatMap((emoji) => [
    [emoji, emoji],
    [emoji.replace("️", ""), emoji],
  ]),
);

/** Convert scanner weather text and traditional cloud-cover marks to a UI weather emoji. */
export function normalizeScannedWeather(value: string | undefined) {
  const input = value?.trim();
  if (!input) return "";

  const exactEmoji = canonicalEmoji.get(input);
  if (exactEmoji) return exactEmoji;

  const normalized = input.toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (matches(normalized, ["tornado", "waterspout", "trombe", "tromba"])) return "🌪️";
  if (matches(normalized, ["thunder", "storm", "orage", "gewitter", "temporale"])) return "⛈️";
  if (matches(normalized, ["snow", "sleet", "neige", "schnee", "neve"])) return "🌨️";
  if (matches(normalized, ["heavy rain", "continuous rain", "pluie", "regen", "pioggia"])) return "🌧️";
  if (matches(normalized, ["rain", "drizzle", "shower", "bruine", "schauer", "niesel"])) return "🌦️";
  if (matches(normalized, ["fog", "mist", "haze", "brouillard", "brume", "nebel", "dunst", "nebbia", "foschia"])) return "🌫️";
  if (matches(normalized, ["overcast", "fully cloudy", "couvert", "bedeckt", "coperto"])) return "☁️";
  if (matches(normalized, ["mostly cloudy", "broken cloud", "tres nuageux", "stark bewolkt", "molto nuvoloso"])) return "🌥️";
  if (matches(normalized, ["partly cloudy", "scattered cloud", "partiellement nuageux", "wolkig", "parzialmente nuvoloso"])) return "⛅";
  if (matches(normalized, ["mostly clear", "few cloud", "peu nuageux", "leicht bewolkt", "poco nuvoloso"])) return "🌤️";
  if (matches(normalized, ["clear", "sunny", "sereno", "soleggiato", "klar", "heiter", "degag"])) return "☀️";
  if (matches(normalized, ["cloudy", "cloud", "nuageux", "bewolkt", "nuvoloso"])) return "☁️";

  const oktas = cloudCoverOktas(normalized);
  return oktas === undefined ? input : cloudCoverEmoji(oktas);
}

function matches(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function cloudCoverOktas(value: string) {
  const fraction = value.match(/(?:^|\D)([0-8])\s*[⁄/]\s*8(?:\D|$)/);
  if (fraction) return Number(fraction[1]);

  const okta = value.match(/(?:^|\D)([0-8])\s*(?:oktas?|eighths?)(?:\D|$)/);
  if (okta) return Number(okta[1]);

  // Common printed station-model cloud-cover symbols, from an open to a filled circle.
  const symbols: Record<string, number> = { "○": 0, "◔": 2, "◑": 4, "◕": 6, "●": 8 };
  return symbols[value];
}

function cloudCoverEmoji(oktas: number) {
  if (oktas === 0) return "☀️";
  if (oktas <= 2) return "🌤️";
  if (oktas <= 4) return "⛅";
  if (oktas <= 7) return "🌥️";
  return "☁️";
}
