import { describe, expect, it } from "vitest";
import { copiedSheetPath, eligibleBoats } from "../../app/components/logbook/SharedLogbookCopy";
import { loginReturnDestination } from "../../app/components/AuthForm";

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

  it("preserves safe shared return destinations after sign-in", () => {
    expect(loginReturnDestination("?callbackUrl=%2Fshare%2Fowner%2Fsheet")).toBe("/share/owner/sheet");
    expect(loginReturnDestination("?callbackUrl=https%3A%2F%2Fevil.test")).toBe("/");
    expect(loginReturnDestination("?callbackUrl=%2F%2Fevil.test")).toBe("/");
  });
});
