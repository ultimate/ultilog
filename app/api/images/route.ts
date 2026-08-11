import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { createStoredImage } from "../../lib/logbook-store";
import { MAX_STORED_IMAGE_BYTES, StoredImageValidationError, validateStoredImage } from "../../lib/validation/stored-image";

// Base64 expands bytes by 4/3; leave a small, fixed allowance for JSON metadata.
export const MAX_STORED_IMAGE_REQUEST_BYTES = Math.ceil(MAX_STORED_IMAGE_BYTES * 4 / 3) + 4096;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_STORED_IMAGE_REQUEST_BYTES) return NextResponse.json({ error: "Image request exceeds the byte limit." }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_STORED_IMAGE_REQUEST_BYTES) return NextResponse.json({ error: "Image request exceeds the byte limit." }, { status: 413 });
  try {
    const { image } = validateStoredImage(JSON.parse(body));
    const stored = await createStoredImage(randomUUID(), image, session.user.id);
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof StoredImageValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid image." }, { status: 400 });
    throw error;
  }
}
