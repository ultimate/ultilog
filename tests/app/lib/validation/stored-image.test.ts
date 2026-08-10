import { describe, expect, it } from "vitest";
import { MAX_STORED_IMAGE_BYTES, validateStoredImage } from "../../../../app/lib/validation/stored-image";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("stored image validation", () => {
  it("accepts the maximum decoded byte size and valid bounded dimensions", () => {
    const data = Buffer.concat([pngSignature, Buffer.alloc(MAX_STORED_IMAGE_BYTES - pngSignature.length)]).toString("base64");
    expect(validateStoredImage({ data, mimeType: "image/png", width: 8192, height: 1 }).bytes).toHaveLength(MAX_STORED_IMAGE_BYTES);
  });

  it.each([
    ["non-canonical base64", { data: pngSignature.toString("base64").replace(/=$/, ""), mimeType: "image/png", width: 1, height: 1 }],
    ["MIME/signature mismatch", { data: pngSignature.toString("base64"), mimeType: "image/jpeg", width: 1, height: 1 }],
    ["non-positive dimensions", { data: pngSignature.toString("base64"), mimeType: "image/png", width: 0, height: 1 }],
  ])("rejects %s", (_name, value) => expect(() => validateStoredImage(value)).toThrow());
});
