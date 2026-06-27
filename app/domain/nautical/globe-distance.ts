export type GpsCoordinates = {
  latitude: number;
  longitude: number;
};

export type GlobeDistanceUnit = "nauticalMiles" | "kilometers";

export type GlobeDistanceOptions = {
  unit?: GlobeDistanceUnit;
};

const earthRadiusByUnit: Record<GlobeDistanceUnit, number> = {
  nauticalMiles: 3440.065,
  kilometers: 6371.0088,
};

function degreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function squaredSine(radians: number) {
  return Math.sin(radians / 2) ** 2;
}

export function calculateGlobeDistance(
  from: GpsCoordinates,
  to: GpsCoordinates,
  options: GlobeDistanceOptions = {},
) {
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);

  const haversine = squaredSine(latitudeDelta) + (
    Math.cos(fromLatitude) * Math.cos(toLatitude) * squaredSine(longitudeDelta)
  );
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusByUnit[options.unit ?? "nauticalMiles"] * centralAngle;
}

export function calculateGlobeDistanceNm(from: GpsCoordinates, to: GpsCoordinates) {
  return calculateGlobeDistance(from, to, { unit: "nauticalMiles" });
}
