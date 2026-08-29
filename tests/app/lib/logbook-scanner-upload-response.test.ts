import { describe, expect, it } from "vitest";
import { readScannerUploadResponse } from "../../../app/lib/logbook-scanner/upload-response";

describe("scanner upload responses", () => {
  it("returns successful JSON responses", async () => {
    const response = Response.json({ sheetId: "sheet-1" }, { status: 201 });
    await expect(readScannerUploadResponse(response, "Upload failed.")).resolves.toEqual({ sheetId: "sheet-1" });
  });

  it("preserves a structured API error", async () => {
    const response = Response.json({ code: "provider_unavailable", error: "Scanner provider is unavailable." }, { status: 503 });
    await expect(readScannerUploadResponse(response, "Upload failed.")).rejects.toThrow("Scanner provider is unavailable.");
  });

  it("adds a diagnostic reference when it is separate from the API message", async () => {
    const response = Response.json({ error: "Unexpected scanner error.", reference: "scan-ref" }, { status: 500 });
    await expect(readScannerUploadResponse(response, "Upload failed.")).rejects.toThrow("Unexpected scanner error. Reference: scan-ref.");
  });

  it("explains a platform-level oversized request instead of returning a generic error", async () => {
    const response = new Response("Request Entity Too Large", { status: 413, headers: { "content-type": "text/html" } });
    await expect(readScannerUploadResponse(response, "Upload failed.")).rejects.toThrow("too large");
  });

  it("includes the status for non-JSON platform errors", async () => {
    const response = new Response("Internal Server Error", { status: 500, headers: { "content-type": "text/html" } });
    await expect(readScannerUploadResponse(response, "Upload failed.")).rejects.toThrow("Upload failed. (HTTP 500)");
  });
});
