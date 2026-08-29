export type ScannerUploadPayload = {
  sheetId?: string;
  code?: string;
  error?: string;
  reference?: string;
};

/** Reads API and hosting-platform errors without hiding useful HTTP diagnostics. */
export async function readScannerUploadResponse(response: Response, fallback: string): Promise<ScannerUploadPayload & { sheetId: string }> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let payload: ScannerUploadPayload = {};

  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => ({})) as ScannerUploadPayload;
  }

  if (response.ok && payload.sheetId) return payload as ScannerUploadPayload & { sheetId: string };
  if (payload.error) {
    const reference = payload.reference && !payload.error.includes(payload.reference) ? ` Reference: ${payload.reference}.` : "";
    throw new Error(`${payload.error}${reference}`);
  }
  if (response.status === 413) {
    throw new Error("The scanner upload was rejected because it is too large. Try a smaller image or fewer images.");
  }

  const status = response.status ? ` (HTTP ${response.status})` : "";
  throw new Error(`${fallback}${status}`);
}
