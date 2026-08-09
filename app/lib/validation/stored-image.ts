import type { StoredImage } from "../../models/stored-image";

export const SUPPORTED_RASTER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_STORED_IMAGE_BYTES = 1024 * 1024;
export const MAX_STORED_IMAGE_DIMENSION = 8192;

export class StoredImageValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectedMimeType(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
}

/** Validates untrusted, JSON-encoded raster image data and returns its decoded bytes. */
export function validateStoredImage(value: unknown, options: { maxBytes?: number; requireDimensions?: boolean } = {}): { image: StoredImage; bytes: Buffer } {
  if (!isRecord(value)) throw new StoredImageValidationError("Image must be an object.");
  const { data, mimeType, width, height } = value;
  if (typeof data !== "string" || typeof mimeType !== "string") throw new StoredImageValidationError("Image data and MIME type must be strings.");
  if (!SUPPORTED_RASTER_MIME_TYPES.includes(mimeType as typeof SUPPORTED_RASTER_MIME_TYPES[number])) throw new StoredImageValidationError("Only JPEG, PNG, and WebP images are supported.");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data) || data.length === 0) throw new StoredImageValidationError("Image data is not strict base64.");
  const bytes = Buffer.from(data, "base64");
  if (bytes.toString("base64") !== data) throw new StoredImageValidationError("Image data is not canonical base64.");
  if (bytes.length > (options.maxBytes ?? MAX_STORED_IMAGE_BYTES)) throw new StoredImageValidationError("Image exceeds the byte limit.");
  if (detectedMimeType(bytes) !== mimeType) throw new StoredImageValidationError("Image MIME type does not match its file signature.");
  const dimensionsRequired = options.requireDimensions ?? true;
  if (dimensionsRequired && (!Number.isInteger(width) || !Number.isInteger(height) || (width as number) <= 0 || (height as number) <= 0 || (width as number) > MAX_STORED_IMAGE_DIMENSION || (height as number) > MAX_STORED_IMAGE_DIMENSION)) {
    throw new StoredImageValidationError("Image dimensions must be positive, bounded integers.");
  }
  return { image: { data, mimeType, width: dimensionsRequired ? width as number : 1, height: dimensionsRequired ? height as number : 1 }, bytes };
}

