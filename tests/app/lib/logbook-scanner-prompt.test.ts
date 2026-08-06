import { describe, expect, it } from "vitest";
import {
  buildScannerUserPrompt,
  formatTemplateRecognitionInstructions,
  formatScannerFieldAliases,
} from "../../../app/lib/logbook-scanner/openai-provider";
import { criticalCourseScannerFields } from "../../../app/lib/logbook-scanner/field-aliases";

describe("logbook scanner prompt", () => {
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

  it("describes conditional recognition and diagnostics for versioned UltiLog templates", () => {
    const instructions = formatTemplateRecognitionInstructions();

    expect(instructions).toContain("ULTILOG:ultilog-logsheet:v1:<variant>:<locale>");
    expect(instructions).toContain("full: time (");
    expect(instructions).toContain("compact: time (");
    expect(instructions).toContain("unsupported revision");
    expect(instructions).toContain("cropped header");
    expect(instructions).toContain("never permission to invent");
  });
});
