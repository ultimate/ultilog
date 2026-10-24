import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n, type Locale } from "../../app/lib/i18n";
import { ModuleTabs } from "../../app/templates/ModuleTabs";
import { useOnboardingProfile } from "../../app/components/onboarding/useOnboardingProfile";
import type { PersistedLogbook } from "../../app/models/logbook";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const logbook = { boats: [], sheets: [], crewMembers: [] } as unknown as PersistedLogbook;
let profile: ReturnType<typeof useOnboardingProfile>;
let locale: Locale;
let root: ReactTestRenderer;
const message = vi.fn();
function Harness() {
  const i18n = useI18n();
  const currentProfile = useOnboardingProfile({ activeModule: "profile", logbook, onProfileError: vi.fn(), onProfileMessage: message, onLocaleChange: i18n.setLocale, t: i18n.t });
  useEffect(() => { locale = i18n.locale; profile = currentProfile; });
  return <ModuleTabs activeModule="profile" onSelectModule={() => {}} onOpenProfile={() => {}} theme="light" onToggleTheme={() => {}} isNavSlim={false} onToggleNavSlim={() => {}} onLogout={() => {}} isLoggingOut={false} onLocaleChange={(language) => { void currentProfile.updatePreferences({ language }); }} />;
}

describe("menu and profile language", () => {
  let savedLanguage: Locale;
  let failSave: boolean;
  beforeEach(() => {
    savedLanguage = "en";
    failSave = false;
    message.mockClear();
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { location: { href: "http://localhost/" }, localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      if (options?.method === "PATCH") {
        if (failSave) return { ok: false, json: async () => ({ error: "Unable to save" }) };
        savedLanguage = JSON.parse(options.body).preferences.language ?? savedLanguage;
      }
      return { ok: true, json: async () => ({ preferences: { language: savedLanguage } }) };
    }));
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    vi.unstubAllGlobals();
  });

  it.each([0, 1])("persists language from menu %i through unrelated preference saves and reloads", async (menuIndex) => {
    await act(async () => { root = create(<I18nProvider><Harness /></I18nProvider>); });
    await act(async () => { root.root.findAllByType("select")[menuIndex].props.onChange({ target: { value: "de" } }); });
    expect(locale).toBe("de");
    expect(profile.preferences.language).toBe("de");
    expect(savedLanguage).toBe("de");
    expect(message).toHaveBeenLastCalledWith("Profileinstellungen aktualisiert.");
    await act(async () => { await profile.updatePreferences({ windUnit: "kn" }); });
    expect(locale).toBe("de");
    expect(profile.preferences.language).toBe("de");
    await act(async () => root.unmount());
    await act(async () => { root = create(<I18nProvider><Harness /></I18nProvider>); });
    expect(locale).toBe("de");
    expect(profile.preferences.language).toBe("de");
  });

  it("keeps both selectors synchronized when changed from the profile", async () => {
    await act(async () => { root = create(<I18nProvider><Harness /></I18nProvider>); });
    await act(async () => { await profile.updatePreferences({ language: "fr" }); });
    expect(root.root.findAllByType("select").map((select) => select.props.value)).toEqual(["fr", "fr"]);
    expect(savedLanguage).toBe("fr");
  });

  it("restores both UI and profile language when saving fails", async () => {
    await act(async () => { root = create(<I18nProvider><Harness /></I18nProvider>); });
    failSave = true;
    await act(async () => { await profile.updatePreferences({ language: "de" }); });
    expect(locale).toBe("en");
    expect(profile.preferences.language).toBe("en");
  });
});
