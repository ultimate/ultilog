export type DirectionalMapPoint = {
  courseOverGround?: number;
  speedKn?: number;
};

export function markerCourse(point: DirectionalMapPoint) {
  if (
    !Number.isFinite(point.speedKn) ||
    Number(point.speedKn) <= 0 ||
    !Number.isFinite(point.courseOverGround)
  ) {
    return null;
  }

  return ((Number(point.courseOverGround) % 360) + 360) % 360;
}
