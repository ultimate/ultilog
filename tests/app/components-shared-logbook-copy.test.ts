import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { copiedSheetPath, copyActionDisabled, eligibleBoats } from "../../app/components/logbook/SharedLogbookCopy";
import { SharedLogbookCopy } from "../../app/components/logbook/SharedLogbookCopy";
import { loginReturnDestination } from "../../app/components/AuthForm";
import { I18nProvider } from "../../app/lib/i18n";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderCopy(overrides: Partial<Parameters<typeof SharedLogbookCopy>[0]> = {}) {
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement(SharedLogbookCopy, {
    ownerId: "owner",
    sheetId: "sheet",
    isAuthenticated: true,
    canCopy: false,
    requiresAuthentication: false,
    missingRequiredSections: ["masterData", "technicalLog"],
    canIncludeCrew: false,
    canIncludePicture: false,
    returnPath: "/share/owner/sheet",
    ...overrides,
  })));
}

describe("shared logbook copy", () => {
  it("offers only non-archived destination boats", () => {
    expect(eligibleBoats({ boats: [
      { id: "active", name: "Aurora", archived: false },
      { id: "archived", name: "Old boat", archived: true },
    ] })).toEqual([{ id: "active", name: "Aurora", archived: false }]);
    expect(eligibleBoats({ boats: [] })).toEqual([]);
    expect(eligibleBoats(null)).toEqual([]);
  });

  it("navigates successful copies to the authenticated detail route", () => {
    expect(copiedSheetPath("new sheet/1")).toBe("/details/new%20sheet%2F1");
  });

  it("keeps copy disabled until authentication, eligibility, and a destination boat are available", () => {
    const boats = [{ id: "boat", name: "Aurora" }];
    expect(copyActionDisabled(false, true, boats)).toBe(true);
    expect(copyActionDisabled(true, false, boats)).toBe(true);
    expect(copyActionDisabled(true, true, null)).toBe(true);
    expect(copyActionDisabled(true, true, [])).toBe(true);
    expect(copyActionDisabled(true, true, boats)).toBe(false);
  });

  it("always shows a disabled copy button and names information the owner must share", () => {
    const markup = renderCopy();
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Copy to my logbook</button>");
    expect(markup).toContain("master data, technical log");
    expect(markup).toContain("Please ask the owner to share this information");
  });

  it("keeps the disabled copy button beside sign-in guidance when authentication unlocks the share", () => {
    const markup = renderCopy({ isAuthenticated: false, requiresAuthentication: true, missingRequiredSections: ["masterData"] });
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Copy to my logbook</button>");
    expect(markup).toContain("Sign in to copy this shared sheet");
    expect(markup).toContain("/login?callbackUrl=%2Fshare%2Fowner%2Fsheet");
  });

  it("preserves safe shared return destinations after sign-in", () => {
    expect(loginReturnDestination("?callbackUrl=%2Fshare%2Fowner%2Fsheet")).toBe("/share/owner/sheet");
    expect(loginReturnDestination("?callbackUrl=https%3A%2F%2Fevil.test")).toBe("/");
    expect(loginReturnDestination("?callbackUrl=%2F%2Fevil.test")).toBe("/");
  });
});
