import { describe, expect, it } from "vitest";
import {
  buildScannerUserPrompt,
  extractLogbookDraft,
  formatTemplateRecognitionInstructions,
  formatScannerFieldAliases,
  formatUserScannerTemplate,
} from "../../../app/lib/logbook-scanner/openai-provider";
import { criticalCourseScannerFields } from "../../../app/lib/logbook-scanner/field-aliases";

describe("logbook scanner prompt", () => {
  it("keeps the structured no-image diagnostic alongside the extended draft shape", async () => {
    await expect(extractLogbookDraft({ files: [] })).resolves.toEqual({
      draft: {
        title: "",
        dateText: "",
        route: { from: "", to: "", departed: "", arrived: "" },
        technicalChecks: [],
        engineHourCounters: [],
        lines: [],
      },
      warnings: [{ code: "noImages" }],
    });
  });

  it("includes canonical fields and terminology from every supported language", () => {
    const glossary = formatScannerFieldAliases();

    expect(glossary).toContain("compassCourse: en=[Compass course");
    expect(glossary).toContain("de=[Magnetkompass-Kurs");
    expect(glossary).toContain("fr=[Cap compas");
    expect(glossary).toContain("it=[Prora bussola");
    expect(glossary).toContain("courseOverGround:");
    expect(glossary).toContain("KüG");
  });

  it("treats the user language as a weak hint and allows mixed-language sheets", () => {
    const prompt = buildScannerUserPrompt("de");

    expect(prompt).toContain("User interface language hint: Deutsch (de)");
    expect(prompt).toContain("preference only");
    expect(prompt).toContain("detect the sheet's actual language independently");
    expect(prompt).toContain("mixture of languages");
  });

  it("describes composite nautical DDM positions", () => {
    const prompt = buildScannerUserPrompt();

    expect(prompt).toContain("split it into latitude and longitude");
    expect(prompt).toContain("DDM is common in nautical logs");
    expect(prompt).toContain("latitude=N49°27.3346'");
    expect(prompt).toContain("longitude=W2°32.0386'");
  });

  it("maps German daily-log master data and abbreviated navigation columns", () => {
    const prompt = buildScannerUserPrompt();

    expect(prompt).toContain("Tagesziel/Daily goal field as the title");
    expect(prompt).toContain("Standort morgens/Location morning as route.from");
    expect(prompt).toContain("Standort abends/Location evening as route.to");
    expect(prompt).toContain("WA (Windabdrift) maps to windDrift");
    expect(prompt).toContain("SA (Stromabdrift) maps to currentDrift");
    expect(prompt).toContain("KüG (Kurs über Grund) maps to courseOverGround");
    expect(prompt).toContain("F [kn] (Fahrt in Knoten) maps to speedKn");
  });

  it("describes the course sequence without allowing calculated values", () => {
    const prompt = buildScannerUserPrompt();

    expect(prompt).toContain(criticalCourseScannerFields.join(" -> "));
    expect(prompt).toContain("A missing intermediate course column never shifts the meaning of later columns");
    expect(prompt).toContain("MgK / Cc, Abl / d, Mw / D, rwK / Cv maps to compassCourse, deviation, variation, trueCourse");
    expect(prompt).toContain("leave magneticCourse empty");
    expect(prompt).toContain("Never calculate, copy, or invent a missing course value");
    expect(prompt).toContain("User interface language hint: none");
  });

  it("distinguishes blank cells, unused printed rows and hatched cloud circles", () => {
    const prompt = buildScannerUserPrompt();
    expect(prompt).toContain("Every blank source cell must remain an empty string");
    expect(prompt).toContain("Do not carry measurements forward");
    expect(prompt).toContain("one-based indexes into draft.lines");
    expect(prompt).toContain("hatched or scribbled");
    expect(prompt).toContain("Technical-check fill circles");
    expect(prompt).toContain("rwK/rwk/rw K (rechtweisender Kurs) maps to trueCourse (TC)");
  });

  it("requires degree-free course numbers and separates measurement units", () => {
    const prompt = buildScannerUserPrompt();
    expect(prompt).toContain("All course and angular correction fields (" + criticalCourseScannerFields.join(", ") + ") are always in degrees");
    expect(prompt).toContain('visible 270° becomes trueCourse="270"');
    expect(prompt).toContain('visible -2° becomes deviation="-2"');
    expect(prompt).toContain('"5 kn" becomes windStrength="5", windUnit="kn"');
    expect(prompt).toContain("Empty cells remain");
    expect(prompt).toContain("preserve their coordinate notation and hemisphere");
    expect(prompt).toContain("Do not convert readings to another unit");
  });

  it("keeps speed and log columns distinct from wind and per-row distances", () => {
    const prompt = buildScannerUserPrompt();
    expect(prompt).toContain("KüG | F kn | Log sm | SM Seg. | SM Mot.");
    expect(prompt).toContain("must not replace vessel speed");
    expect(prompt).toContain('output logNm="25397"');
    expect(prompt).toContain("never infer a prefix");
    expect(prompt).toContain("Keep rows in their physical document order");
  });

  it("describes conditional recognition and diagnostics for versioned UltiLog templates", () => {
    const instructions = formatTemplateRecognitionInstructions();

    expect(instructions).toContain("ULTILOG:ultilog-logsheet:v3:<variant>:<locale>");
    expect(instructions).toContain("full: time (");
    expect(instructions).toContain("compact: time (");
    expect(instructions).toContain("unsupported revision");
    expect(instructions).toContain("cropped header");
    expect(instructions).toContain("never permission to invent");
  });

  it("passes configured technical checks and engine identities as recognition anchors", () => {
    const instructions = formatUserScannerTemplate({
      technicalChecks: ["Engine oil", "Custom bilge alarm"],
      engines: [{ id: "port-engine", label: "Port", name: "Volvo Penta", role: "propulsion" }],
    });

    expect(instructions).toContain('"Engine oil", "Custom bilge alarm"');
    expect(instructions).toContain("Return each matched label exactly as supplied");
    expect(instructions).toContain("port-engine | Port | Volvo Penta | propulsion");
    expect(instructions).toContain("Distinguish start/from and end/to readings from per-row operating hours");
  });
});
