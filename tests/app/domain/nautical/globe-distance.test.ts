import { describe, expect, it } from "vitest";
import { calculateGlobeDistance, calculateGlobeDistanceNm, type GpsCoordinates } from "../../../../app/domain/nautical/globe-distance";
import type { Position } from "../../../../app/domain/nautical/position";

describe("globe distance", () => {
  it("uses the shared geographic position type", () => {
    const position: Position = { latitude: 0, longitude: 0 };
    const coordinates: GpsCoordinates = position;

    expect(coordinates).toEqual(position);
  });

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

  describe("with arc-minute and arc-second coordinate differences", () => {
    const arcMinute = 1 / 60;
    const arcSecond = 1 / 3600;

    it("calculates distance between two points on the equator", () => {
      expect(calculateGlobeDistanceNm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: arcMinute },
      )).toBeCloseTo(1.0007, 4);

      expect(calculateGlobeDistanceNm(
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: arcSecond },
      )).toBeCloseTo(0.01668, 5);
    });

    it("calculates distance between two points near a pole", () => {
      expect(calculateGlobeDistanceNm(
        { latitude: 89 + (59 * arcMinute), longitude: 0 },
        { latitude: 89 + (59 * arcMinute), longitude: 90 * arcSecond },
      )).toBeCloseTo(0.0004366, 7);
    });

    it("calculates the shortest distance across the date boundary", () => {
      expect(calculateGlobeDistanceNm(
        { latitude: 10, longitude: 179 + (59 * arcMinute) + (50 * arcSecond) },
        { latitude: 10, longitude: -179 - (59 * arcMinute) - (50 * arcSecond) },
      )).toBeCloseTo(0.3285, 4);
    });

    it("calculates distance across both the equator and date boundary", () => {
      expect(calculateGlobeDistanceNm(
        { latitude: 10 * arcSecond, longitude: 179 + (59 * arcMinute) + (50 * arcSecond) },
        { latitude: -10 * arcSecond, longitude: -179 - (59 * arcMinute) - (50 * arcSecond) },
      )).toBeCloseTo(0.4717, 4);
    });

    it("keeps date-boundary distances symmetrical when crossing the equator in reverse", () => {
      const northEastToSouthWest = calculateGlobeDistanceNm(
        { latitude: 2 * arcMinute, longitude: 179 + (58 * arcMinute) },
        { latitude: -2 * arcMinute, longitude: -179 - (58 * arcMinute) },
      );
      const southWestToNorthEast = calculateGlobeDistanceNm(
        { latitude: -2 * arcMinute, longitude: -179 - (58 * arcMinute) },
        { latitude: 2 * arcMinute, longitude: 179 + (58 * arcMinute) },
      );

      expect(northEastToSouthWest).toBeCloseTo(5.6607, 4);
      expect(southWestToNorthEast).toBeCloseTo(northEastToSouthWest, 10);
    });

    it("keeps square diagonals equal while the edge closer to the equator is longer", () => {
      const southWest = { latitude: 0, longitude: 0 };
      const southEast = { latitude: 0, longitude: arcMinute };
      const northWest = { latitude: arcMinute, longitude: 0 };
      const northEast = { latitude: arcMinute, longitude: arcMinute };

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
        { latitude: 0, longitude: arcMinute },
        { unit: "kilometers" },
      )).toBeCloseTo(1.8533, 4);
    });
  });

});
