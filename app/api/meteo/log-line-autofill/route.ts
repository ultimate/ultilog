import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createFreeMeteoService, meteoSnapshotToLogLineAutofill, type MeteoLogLineAutofillOptions } from "../../../domain/meteo";
import { consumeRateLimit, rateLimitResponse } from "../../../lib/security/rate-limiter";

const meteoService = createFreeMeteoService({ cacheTtlMs: 10 * 60 * 1_000 });

type MeteoAutofillRequest = MeteoLogLineAutofillOptions & {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const quota = await consumeRateLimit({ name: "meteo-autofill-user", limit: 30, windowMs: 60 * 60_000 }, session.user.id);
  if (!quota.allowed) return rateLimitResponse(quota, "Weather autofill quota exceeded. Please try again later.");

  const body = await request.json() as MeteoAutofillRequest;
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Latitude and longitude are required." }, { status: 400 });
  }

  const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: "Timestamp is invalid." }, { status: 400 });
  }

  try {
    const snapshot = await meteoService.getSnapshot({
      latitude,
      longitude,
      timestamp,
    });

    return NextResponse.json(meteoSnapshotToLogLineAutofill(snapshot, {
      temperatureUnit: body.temperatureUnit,
      windUnit: body.windUnit,
      seaUnit: body.seaUnit,
      tideUnit: body.tideUnit,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch meteo data." }, { status: 502 });
  }
}
