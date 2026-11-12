import type { CourseConversionVariationLookupRequest } from "./course-conversion";

// Position/date are sufficient: changing a course does not change declination.
const lookups = new Map<string, { expires: number; promise: Promise<number> }>();
export function lookupMagneticVariation({ latitude, longitude, date = new Date() }: CourseConversionVariationLookupRequest): Promise<number> {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), date: date.toISOString().slice(0, 10) });
  const key = query.toString();
  const cached = lookups.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetch(`/api/navigation/magnetic-variation?${query}`).then(async response => {
    if (!response.ok) throw new Error("Magnetic variation lookup failed.");
    const body = await response.json() as { variation?: number };
    if (typeof body.variation !== "number" || !Number.isFinite(body.variation)) throw new Error("Invalid magnetic variation response.");
    return body.variation;
  });
  if (lookups.size >= 128) lookups.delete(lookups.keys().next().value!);
  lookups.set(key, { expires: Date.now() + 600_000, promise });
  void promise.catch(() => { if (lookups.get(key)?.promise === promise) lookups.delete(key); });
  return promise;
}
