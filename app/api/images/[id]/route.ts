import { NextResponse } from "next/server";
import { guardMutationOrigin } from "../../../lib/security/request-origin";
import { auth } from "../../../../auth";
import { deleteStoredImage, readStoredImage } from "../../../lib/logbook-store";

type Context = { params: Promise<{ id: string }> };
async function owner() { return (await auth())?.user?.id; }

export async function GET(_request: Request, context: Context) {
  const ownerId = await owner();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const image = await readStoredImage((await context.params).id, ownerId);
  return image ? NextResponse.json(image) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request, context: Context) {
  const originError = guardMutationOrigin(request);
  if (originError) return originError;
  const ownerId = await owner();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const deleted = await deleteStoredImage((await context.params).id, ownerId);
    return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "referenced_image") return NextResponse.json({ error: "Stored image is still referenced.", code: "referenced_image" }, { status: 409 });
    throw error;
  }
}
