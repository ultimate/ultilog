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

  it("calculates the shortest distance across the date boundary", () => {
    expect(calculateGlobeDistanceNm(
      { latitude: 10, longitude: 179 },
      { latitude: 10, longitude: -179 },
    )).toBeCloseTo(118.26, 2);
  });

  it("calculates distance across both the equator and date boundary", () => {
    expect(calculateGlobeDistanceNm(
      { latitude: 1, longitude: 179 },
      { latitude: -1, longitude: -179 },
    )).toBeCloseTo(169.82, 2);
  });

  it("keeps date-boundary distances symmetrical when crossing the equator in reverse", () => {
    const northEastToSouthWest = calculateGlobeDistanceNm(
      { latitude: 2, longitude: 176 },
      { latitude: -2, longitude: -176 },
    );
    const southWestToNorthEast = calculateGlobeDistanceNm(
      { latitude: -2, longitude: -176 },
      { latitude: 2, longitude: 176 },
    );

    expect(northEastToSouthWest).toBeCloseTo(536.93, 2);
    expect(southWestToNorthEast).toBeCloseTo(northEastToSouthWest, 10);
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
