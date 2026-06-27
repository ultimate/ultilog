import { describe, expect, it } from "vitest";
import { calculateCourseConversion, normalizeCourse } from "../../../../app/domain/nautical/course-conversion";

describe("course conversion", () => {
  it("normalizes courses into the 0..359 range", () => {
    expect(normalizeCourse(360)).toBe(0);
    expect(normalizeCourse(725)).toBe(5);
    expect(normalizeCourse(-10)).toBe(350);
  });

  it("calculates the full chain from compass course and deltas", () => {
    expect(calculateCourseConversion({
      compassCourse: 100,
      deviation: -2,
      variation: 4,
      windDrift: -6,
      currentDrift: 3,
    })).toEqual({
      compassCourse: 100,
      deviation: -2,
      magneticCourse: 98,
      variation: 4,
      trueCourse: 102,
      windDrift: -6,
      courseThroughWater: 96,
      currentDrift: 3,
      courseOverGround: 99,
    });
  });

  it("calculates the full chain backwards from course over ground and deltas", () => {
    expect(calculateCourseConversion({
      deviation: -2,
      variation: 4,
      windDrift: -6,
      currentDrift: 3,
      courseOverGround: 99,
    })).toEqual({
      compassCourse: 100,
      deviation: -2,
      magneticCourse: 98,
      variation: 4,
      trueCourse: 102,
      windDrift: -6,
      courseThroughWater: 96,
      currentDrift: 3,
      courseOverGround: 99,
    });
  });

  it("derives missing deltas when adjacent course values are known", () => {
    expect(calculateCourseConversion({
      compassCourse: 350,
      magneticCourse: 10,
      trueCourse: 5,
      courseThroughWater: 355,
      courseOverGround: 2,
    })).toEqual({
      compassCourse: 350,
      deviation: 20,
      magneticCourse: 10,
      variation: -5,
      trueCourse: 5,
      windDrift: -10,
      courseThroughWater: 355,
      currentDrift: 7,
      courseOverGround: 2,
    });
  });

  it("calculates as much as possible for disconnected partial input", () => {
    expect(calculateCourseConversion({
      compassCourse: 20,
      deviation: 5,
      windDrift: -4,
      courseOverGround: 80,
    })).toEqual({
      compassCourse: 20,
      deviation: 5,
      magneticCourse: 25,
      windDrift: -4,
      courseOverGround: 80,
    });
  });

  it("interpolates deviation between table entries for compass courses", () => {
    expect(calculateCourseConversion({
      compassCourse: 15,
      variation: 1,
    }, {
      0: 2,
      10: 5,
      20: 3,
      30: 1,
      40: -3,
    })).toEqual({
      compassCourse: 15,
      deviation: 4,
      magneticCourse: 19,
      variation: 1,
      trueCourse: 20,
    });
  });

  it("interpolates deviation across north", () => {
    expect(calculateCourseConversion({
      compassCourse: 355,
    }, {
      350: 4,
      0: 2,
      10: 5,
    })).toEqual({
      compassCourse: 355,
      deviation: 3,
      magneticCourse: 358,
    });
  });


  it("uses interpolated deviation to derive compass course from magnetic course", () => {
    expect(calculateCourseConversion({
      magneticCourse: 19,
      variation: 1,
    }, {
      0: 2,
      10: 5,
      20: 3,
      30: 1,
      40: -3,
    })).toEqual({
      compassCourse: 15,
      deviation: 4,
      magneticCourse: 19,
      variation: 1,
      trueCourse: 20,
    });
  });

  it("uses a deviation table when compass course is known but deviation is missing", () => {
    expect(calculateCourseConversion({
      compassCourse: 40,
      variation: 2,
      windDrift: -1,
      currentDrift: 4,
    }, {
      0: 2,
      10: 5,
      20: 3,
      30: 1,
      40: -3,
    })).toEqual({
      compassCourse: 40,
      deviation: -3,
      magneticCourse: 37,
      variation: 2,
      trueCourse: 39,
      windDrift: -1,
      courseThroughWater: 38,
      currentDrift: 4,
      courseOverGround: 42,
    });
  });

  it("uses a deviation table to derive compass course from magnetic course", () => {
    expect(calculateCourseConversion({
      magneticCourse: 37,
      variation: 2,
    }, {
      0: 2,
      10: 5,
      20: 3,
      30: 1,
      40: -3,
    })).toEqual({
      compassCourse: 40,
      deviation: -3,
      magneticCourse: 37,
      variation: 2,
      trueCourse: 39,
    });
  });

  it("does not guess a compass course from an ambiguous deviation table", () => {
    expect(calculateCourseConversion({
      magneticCourse: 12,
    }, {
      0: 12,
      10: 2,
    })).toEqual({
      magneticCourse: 12,
    });
  });
});
