import { describe, expect, it } from "vitest";
import { markerCourse } from "../../../app/components/logbook/map-marker";

describe("markerCourse", () => {
  it("returns a normalized course for positions with speed", () => {
    expect(markerCourse({ speedKn: 6, courseOverGround: 90 })).toBe(90);
    expect(markerCourse({ speedKn: 6, courseOverGround: 360 })).toBe(0);
    expect(markerCourse({ speedKn: 6, courseOverGround: -10 })).toBe(350);
  });

  it("keeps positions without speed circular", () => {
    expect(markerCourse({ speedKn: 0, courseOverGround: 90 })).toBeNull();
    expect(markerCourse({ speedKn: -1, courseOverGround: 90 })).toBeNull();
    expect(markerCourse({ courseOverGround: 90 })).toBeNull();
  });

  it("keeps positions without a valid course circular", () => {
    expect(markerCourse({ speedKn: 6 })).toBeNull();
    expect(markerCourse({ speedKn: 6, courseOverGround: Number.NaN })).toBeNull();
  });
});
