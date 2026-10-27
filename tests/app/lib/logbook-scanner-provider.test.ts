import { afterEach, describe, expect, it, vi } from "vitest";
import { extractLogbookDraft } from "../../../app/lib/logbook-scanner/openai-provider";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("OpenAI scanner request", () => {
  it.each([undefined, "custom-model"])("uses the new default and supports an override (%s)", async model => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("LOGBOOK_SCANNER_MODEL", model);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ draft: { lines: [{ time: "09:00" }, {}] }, warnings: [{ code: "missingFields", row: 2, fields: ["time"] }] }) }] }] })));
    vi.stubGlobal("fetch", fetch);
    const result = await extractLogbookDraft({ files: [{ name: "test.jpg", type: "image/jpeg", buffer: Buffer.from("test") }] });
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.model).toBe(model ?? "gpt-6-luna");
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.input[1].content[1]).toMatchObject({ type: "input_image", detail: "high" });
    expect(result.draft.lines).toHaveLength(1);
    expect(result.warnings.every(warning => warning.row === undefined || warning.row === 1)).toBe(true);
  });
});
