import { describe, expect, it } from "vitest";
import { calculateCourseConversion, normalizeCourse } from "../../../../app/domain/nautical/course-conversion";
import { lookupNoaaMagneticVariation } from "../../../../app/domain/nautical/noaa-magnetic-variation";

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


describe("NOAA magnetic variation lookup", () => {
  it("calls NOAA declination API with coordinates and returns declination", async () => {
    const fetcher = async (url: URL) => {
      expect(url.origin + url.pathname).toBe("https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination");
      expect(url.searchParams.get("lat1")).toBe("52");
      expect(url.searchParams.get("lon1")).toBe("4");
      expect(url.searchParams.get("resultFormat")).toBe("json");
      expect(url.searchParams.get("model")).toBe("WMM");
      expect(url.searchParams.get("startYear")).toBe("2026");
      expect(url.searchParams.get("startMonth")).toBe("6");
      expect(url.searchParams.get("startDay")).toBe("27");

      return new Response(JSON.stringify({ result: [{ declination: "3.25" }] }));
    };

    await expect(lookupNoaaMagneticVariation({
      latitude: 52,
      longitude: 4,
      date: new Date(Date.UTC(2026, 5, 27)),
      fetcher: fetcher as typeof fetch,
    })).resolves.toBe(3.25);
  });
});

describe("course conversion with position", () => {
  it("looks up missing variation from position and date", async () => {
    const logDate = new Date(Date.UTC(2025, 3, 5));

    await expect(calculateCourseConversion({
      magneticCourse: 98,
    }, undefined, {
      position: { latitude: 52, longitude: 4 },
      date: logDate,
      variationLookup: async (request) => {
        expect(request).toEqual({ latitude: 52, longitude: 4, date: logDate });
        return 4;
      },
    })).resolves.toEqual({
      magneticCourse: 98,
      variation: 4,
      trueCourse: 102,
    });
  });

  it("does not look up variation when it is already provided", () => {
    expect(calculateCourseConversion({
      magneticCourse: 98,
      variation: 4,
    }, undefined, {
      position: { latitude: 52, longitude: 4 },
      variationLookup: async () => {
        throw new Error("should not be called");
      },
    })).toEqual({
      magneticCourse: 98,
      variation: 4,
      trueCourse: 102,
    });
  });

  it("keeps the synchronous conversion path when position options are null", () => {
    expect(calculateCourseConversion({
      magneticCourse: 98,
      variation: 4,
    }, undefined, null)).toEqual({
      magneticCourse: 98,
      variation: 4,
      trueCourse: 102,
    });
  });
});

it("derives wind drift from the wind drift table using relative wind angle", () => {
  expect(calculateCourseConversion({
    trueCourse: 100,
  }, undefined, {
    windDirection: 185,
    windSpeedKnots: 18,
    windDriftTable: {
      windSpeedLimits: { fullSail: 0, secondReef: 15, stormSail: 30 },
      rows: {
        closeHauled: { fullSail: 4, secondReef: 8, stormSail: 16 },
        beamReach: { fullSail: 2, secondReef: 4, stormSail: 8 },
        broadReach: { fullSail: 1, secondReef: 2, stormSail: 4 },
      },
    },
  })).toEqual({
    trueCourse: 100,
    windDrift: -4,
    courseThroughWater: 96,
  });
});


it("applies positive wind drift across north when true course is clockwise from wind", () => {
  expect(calculateCourseConversion({ trueCourse: 10 }, undefined, {
    windDirection: 350,
    windSpeedKnots: 5,
    windDriftTable: {
      windSpeedLimits: { fullSail: 0, secondReef: 15, stormSail: 30 },
      rows: {
        closeHauled: { fullSail: 3, secondReef: 6, stormSail: 9 },
        beamReach: { fullSail: 2, secondReef: 4, stormSail: 8 },
        broadReach: { fullSail: 1, secondReef: 2, stormSail: 4 },
      },
    },
  })).toMatchObject({ windDrift: 3, courseThroughWater: 13 });
});
