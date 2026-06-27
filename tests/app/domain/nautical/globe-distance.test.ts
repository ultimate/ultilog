import { describe, expect, it } from "vitest";
import { calculateGlobeDistance, calculateGlobeDistanceNm } from "../../../../app/domain/nautical/globe-distance";

describe("globe distance", () => {
  it("calculates distance between two points on the equator", () => {
    expect(calculateGlobeDistanceNm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    )).toBeCloseTo(60.04, 2);
  });

  it("calculates distance between two points near a pole", () => {
    expect(calculateGlobeDistanceNm(
      { latitude: 89, longitude: 0 },
      { latitude: 89, longitude: 90 },
    )).toBeCloseTo(84.91, 2);
  });

  it("keeps square diagonals equal while the edge closer to the equator is longer", () => {
    const southWest = { latitude: 0, longitude: 0 };
    const southEast = { latitude: 0, longitude: 10 };
    const northWest = { latitude: 10, longitude: 0 };
    const northEast = { latitude: 10, longitude: 10 };

    const diagonalFromSouthWest = calculateGlobeDistanceNm(southWest, northEast);
    const diagonalFromSouthEast = calculateGlobeDistanceNm(southEast, northWest);
    const equatorSide = calculateGlobeDistanceNm(southWest, southEast);
    const polewardSide = calculateGlobeDistanceNm(northWest, northEast);

    expect(diagonalFromSouthWest).toBeCloseTo(diagonalFromSouthEast, 10);
    expect(equatorSide).toBeGreaterThan(polewardSide);
  });

  it("can return kilometers when requested", () => {
    expect(calculateGlobeDistance(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { unit: "kilometers" },
    )).toBeCloseTo(111.20, 2);
  });
});
