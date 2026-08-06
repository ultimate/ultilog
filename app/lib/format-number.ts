const MILES_FRACTION_DIGITS = 2;

/** Formats nautical miles for display without exposing floating-point noise. */
export function formatMiles(value: number, locale?: Intl.LocalesArgument) {
  return value.toLocaleString(locale, {
    maximumFractionDigits: MILES_FRACTION_DIGITS,
  });
}
