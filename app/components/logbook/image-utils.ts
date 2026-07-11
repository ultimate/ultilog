import type { StoredImage } from "../../models/logbook";

export const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_DIMENSION = 1024;
export const DEFAULT_IMAGE_QUALITY = 0.72;

export type StoredImageOptions = {
  maxBytes?: number;
  maxDimension?: number;
  quality?: number;
};

export function validateImageFile(file: Pick<File, "type" | "size">, options: StoredImageOptions = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Unsupported file type. Please choose an image file.");
  }
  if (file.size > maxBytes) {
    throw new Error(`Image is too large. Please choose an image smaller than ${formatBytes(maxBytes)}.`);
  }
}

export function scaleToMaxDimension(width: number, height: number, maxDimension = DEFAULT_MAX_IMAGE_DIMENSION) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions could not be read.");
  }
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error("Maximum image dimension must be greater than zero.");
  }
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width: Math.round(width), height: Math.round(height) };
  const ratio = maxDimension / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export async function fileToStoredImage(file: File, options: StoredImageOptions = {}): Promise<StoredImage> {
  validateImageFile(file, options);
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const quality = options.quality ?? DEFAULT_IMAGE_QUALITY;
  const source = await decodeImage(file);
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const target = scaleToMaxDimension(width, height, maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not available in this browser.");
  context.drawImage(source, 0, 0, target.width, target.height);
  if ("close" in source) source.close();
  const webp = canvas.toDataURL("image/webp", quality);
  const dataUrl = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
  const [header, data] = dataUrl.split(",", 2);
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
  if (!data) throw new Error("Image export failed.");
  return { mimeType, data, width: target.width, height: target.height };
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded."));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}
