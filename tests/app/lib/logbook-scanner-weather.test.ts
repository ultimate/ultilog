import { describe, expect, it } from "vitest";
import { normalizeScannedWeather } from "../../../app/lib/logbook-scanner/weather";

describe("scanner weather normalization", () => {
  it.each([
    ["cloudy", "☁️"],
    ["partly cloudy", "⛅"],
    ["light rain showers", "🌦️"],
    ["Gewitter", "⛈️"],
    ["brouillard", "🌫️"],
    ["poco nuvoloso", "🌤️"],
  ])("maps recognized condition %s to %s", (condition, emoji) => {
    expect(normalizeScannedWeather(condition)).toBe(emoji);
  });

  it.each([
    ["0/8", "☀️"],
    ["2 oktas", "🌤️"],
    ["3/8", "⛅"],
    ["◑", "⛅"],
    ["6 eighths", "🌥️"],
    ["●", "☁️"],
  ])("maps cloud cover %s to %s", (mark, emoji) => {
    expect(normalizeScannedWeather(mark)).toBe(emoji);
  });

  it("canonicalizes supported emoji variants and preserves unknown scanner text for review", () => {
    expect(normalizeScannedWeather("☀")).toBe("☀️");
    expect(normalizeScannedWeather("unreadable mark")).toBe("unreadable mark");
  });
});
