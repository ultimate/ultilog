import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { createScannedSheet } from "../../../lib/logbook-scanner/create-scanned-sheet";
import { openAiScannerProvider } from "../../../lib/logbook-scanner/openai-provider";
import { readLogbook, writeLogbook } from "../../../lib/logbook-store";

const MAX_FILE_COUNT = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type ScannerErrorCode =
  | "unauthenticated"
  | "missing_boat"
  | "invalid_boat"
  | "unsupported_file_type"
  | "file_too_large"
  | "too_many_files"
  | "missing_files"
  | "provider_configuration_missing"
  | "provider_unavailable"
  | "no_readable_logbook_data";

type ScannerErrorResponse = {
  code: ScannerErrorCode;
  error: string;
};


export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return scannerError("unauthenticated", "Sign in to scan logbook pages.", 401);

  if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
    return scannerError("unsupported_file_type", "Upload logbook images with multipart/form-data.", 415);
  }

  const formData = await request.formData();
  const boatId = formData.get("boatId");
  if (typeof boatId !== "string" || !boatId.trim()) {
    return scannerError("missing_boat", "Choose a boat before scanning logbook pages.", 400);
  }

  const logbook = await readLogbook(session.user.id);
  if (!logbook.boats.some((boat) => boat.id === boatId)) {
    return scannerError("invalid_boat", "The selected boat is not available in your logbook.", 404);
  }

  const uploadedFiles = formData.getAll("files").filter((value): value is File => value instanceof File);
  const fileValidationError = validateFiles(uploadedFiles);
  if (fileValidationError) {
    return scannerError(fileValidationError.code, fileValidationError.error, fileValidationError.status);
  }

  if (!openAiScannerProvider.isConfigured()) {
    return scannerError("provider_configuration_missing", "Scanner provider is not configured. Set OPENAI_API_KEY before scanning logbook pages.", 503);
  }

  let scannerResult;
  try {
    scannerResult = await openAiScannerProvider.extractLogbookDraft({
      files: await Promise.all(uploadedFiles.map(fileToScannerInput)),
    });
  } catch (error) {
    console.error("Logbook scanner provider failed", error);
    return scannerError("provider_unavailable", "Scanner provider is temporarily unavailable. Please try again later.", 503);
  }

  if (!hasReadableLogbookData(scannerResult)) {
    return scannerError("no_readable_logbook_data", "No readable logbook data was found in the uploaded image(s). Try a clearer photo or enter the sheet manually.", 422);
  }
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
  if (files.length === 0) {
    return { code: "missing_files", error: "Select at least one logbook image to scan.", status: 400 } as const;
  }
  if (files.length > MAX_FILE_COUNT) {
    return { code: "too_many_files", error: `Upload at most ${MAX_FILE_COUNT} images at a time.`, status: 413 } as const;
  }

  const invalidType = files.find((file) => !file.type.toLowerCase().startsWith("image/"));
  if (invalidType) {
    return { code: "unsupported_file_type", error: "Only image files can be scanned.", status: 415 } as const;
  }

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
  if (oversized) {
    return { code: "file_too_large", error: `Each image must be ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB or smaller.`, status: 413 } as const;
  }

  return undefined;
}

function scannerError(code: ScannerErrorCode, error: string, status: number) {
  return NextResponse.json({ code, error } satisfies ScannerErrorResponse, { status });
}

function hasReadableLogbookData(scannerResult: Awaited<ReturnType<typeof openAiScannerProvider.extractLogbookDraft>>) {
  const draft = scannerResult.draft;
  const routeValues = Object.values(draft.route ?? {});
  const sheetValues = [draft.title, draft.dateRange, ...routeValues];
  const lineValues = draft.lines.flatMap((line) => Object.values(line));

  return [...sheetValues, ...lineValues].some((value) => typeof value === "string" && value.trim().length > 0);
}

async function fileToScannerInput(file: File) {
  return {
    name: file.name,
    type: file.type,
    buffer: Buffer.from(await file.arrayBuffer()),
  };
}
