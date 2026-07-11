import { describe, expect, it } from "vitest";
import { scaleToMaxDimension, validateImageFile } from "../../app/components/logbook/image-utils";

describe("logbook image utilities", () => {
  it("rejects unsupported files", () => {
    expect(() => validateImageFile({ type: "application/pdf", size: 128 } as File)).toThrow("Unsupported file type");
  });

  it("rejects files above the configured maximum", () => {
    expect(() => validateImageFile({ type: "image/png", size: 11 } as File, { maxBytes: 10 })).toThrow("Image is too large");
  });

  it("keeps images within the max dimension unchanged", () => {
    expect(scaleToMaxDimension(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("scales landscape and portrait images proportionally", () => {
    expect(scaleToMaxDimension(4000, 2000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(scaleToMaxDimension(2000, 4000, 1000)).toEqual({ width: 500, height: 1000 });
  });

  it("rejects invalid dimensions", () => {
    expect(() => scaleToMaxDimension(0, 400, 1000)).toThrow("dimensions");
    expect(() => scaleToMaxDimension(400, 400, 0)).toThrow("Maximum image dimension");
  });
});
