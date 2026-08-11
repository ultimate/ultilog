import { describe, expect, it } from "vitest";
import { StoredImageValidationError, validateStoredImage } from "../../../app/lib/validation/stored-image";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("stored image validation", () => {
  it("accepts canonical base64 when MIME and signature agree", () => {
    expect(validateStoredImage({ data: png.toString("base64"), mimeType: "image/png", width: 1, height: 1 }).bytes).toEqual(png);
  });

  it("rejects MIME/signature mismatches and decoded-byte overflow", () => {
    expect(() => validateStoredImage({ data: png.toString("base64"), mimeType: "image/jpeg", width: 1, height: 1 })).toThrow(StoredImageValidationError);
    expect(() => validateStoredImage({ data: png.toString("base64"), mimeType: "image/png", width: 1, height: 1 }, { maxBytes: 7 })).toThrow("byte limit");
  });
});
