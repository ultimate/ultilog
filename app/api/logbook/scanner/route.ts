import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createScannedSheet } from "../../../lib/logbook-scanner/create-scanned-sheet";
import { openAiScannerProvider } from "../../../lib/logbook-scanner/openai-provider";
import { readLogbook, writeLogbook } from "../../../lib/logbook-store";

const MAX_FILE_COUNT = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const formData = await request.formData();
  const boatId = formData.get("boatId");
  if (typeof boatId !== "string" || !boatId.trim()) {
    return NextResponse.json({ error: "boatId is required" }, { status: 400 });
  }

  const logbook = await readLogbook(session.user.id);
  if (!logbook.boats.some((boat) => boat.id === boatId)) {
    return NextResponse.json({ error: "Boat not found" }, { status: 404 });
  }

  const uploadedFiles = formData.getAll("files").filter((value): value is File => value instanceof File);
  const fileValidationError = validateFiles(uploadedFiles);
  if (fileValidationError) {
    return NextResponse.json({ error: fileValidationError }, { status: 400 });
  }

  const scannerResult = await openAiScannerProvider.extractLogbookDraft({
    files: await Promise.all(uploadedFiles.map(fileToScannerInput)),
  });
  const sheet = createScannedSheet({
    scannerResult,
    boatId,
    currentUser: session.user.name ? { name: session.user.name } : undefined,
    logbook,
  });

  await writeLogbook({ ...logbook, sheets: [...logbook.sheets, sheet] }, session.user.id);

  return NextResponse.json({ sheetId: sheet.id });
}

function validateFiles(files: File[]) {
  if (files.length === 0) return "At least one image file is required";
  if (files.length > MAX_FILE_COUNT) return `Too many files. Upload at most ${MAX_FILE_COUNT} images.`;

  const invalidType = files.find((file) => !file.type.toLowerCase().startsWith("image/"));
  if (invalidType) return "Only image files can be scanned";

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
  if (oversized) return `Each image must be ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB or smaller.`;

  return undefined;
}

async function fileToScannerInput(file: File) {
  return {
    name: file.name,
    type: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
  };
}
