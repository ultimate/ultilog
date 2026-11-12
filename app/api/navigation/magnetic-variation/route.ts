import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { lookupNoaaMagneticVariation } from "../../../domain/nautical/noaa-magnetic-variation";
import { consumeRateLimit, rateLimitResponse } from "../../../lib/security/rate-limiter";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const latitude = Number(query.get("latitude"));
  const longitude = Number(query.get("longitude"));
  const dateText = query.get("date") ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${dateText}T00:00:00Z`);
  if (!query.get("latitude")?.trim() || !query.get("longitude")?.trim() || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) {
    return NextResponse.json({ error: "Valid coordinates and date are required." }, { status: 400 });
  }
  const apiKey = process.env.NOAA_GEOMAG_DECLINATION_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Magnetic variation provider is not configured." }, { status: 503 });
  const quota = await consumeRateLimit({ name: "magnetic-variation-user", limit: 60, windowMs: 60_000 }, session.user.id);
  if (!quota.allowed) return rateLimitResponse(quota, "Magnetic variation quota exceeded. Please try again later.");
  try {
    const variation = await lookupNoaaMagneticVariation({ latitude, longitude, date, apiKey });
    return NextResponse.json({ variation }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to obtain magnetic variation." }, { status: 502 });
  }
}
