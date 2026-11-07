import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../app/lib/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../app/lib/authorization", () => ({ userCanAccessRegisteredShares: vi.fn() }));
vi.mock("../../app/lib/logbook-store", () => ({ readSharedLogSheet: vi.fn(), readSharedLogSheets: vi.fn() }));
vi.mock("../../app/lib/users", () => ({ findUserById: vi.fn() }));
vi.mock("../../app/components/logbook/OpenSeaMapView", () => ({ LogLinesMapView: () => null }));

const { auth } = await import("../../auth");
const { userCanAccessRegisteredShares } = await import("../../app/lib/authorization");
const { readSharedLogSheet, readSharedLogSheets } = await import("../../app/lib/logbook-store");
const { default: SharedLogbookPage } = await import("../../app/share/[[...segments]]/page");

async function openShare(segments: string[], embed = false) {
  return SharedLogbookPage({ params: Promise.resolve({ segments }), searchParams: Promise.resolve(embed ? { embed: "1" } : {}) });
}

describe("shared logbook page access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "demo-viewer" } } as never);
    vi.mocked(userCanAccessRegisteredShares).mockResolvedValue(false);
    vi.mocked(readSharedLogSheet).mockResolvedValue(undefined);
    vi.mocked(readSharedLogSheets).mockResolvedValue(undefined);
  });

  it.each([false, true])("uses public-only visibility for demo collections (embed=%s)", async embed => {
    vi.mocked(readSharedLogSheets).mockResolvedValueOnce({ ownerId: "owner", ownerName: "Owner", sheets: [] });
    await openShare(["owner"], embed);
    expect(userCanAccessRegisteredShares).toHaveBeenCalledWith("demo-viewer");
    expect(readSharedLogSheets).toHaveBeenCalledWith("owner", false);
  });

  it.each([["sheet"], ["owner", "sheet"]])("uses public-only visibility for demo sheet URLs %j", async (...segments) => {
    await openShare(segments);
    expect(readSharedLogSheet).toHaveBeenCalledWith("sheet", false, segments.length === 2 ? "owner" : undefined);
  });

  it("preserves registered-only visibility for registered users", async () => {
    vi.mocked(userCanAccessRegisteredShares).mockResolvedValueOnce(true);
    await openShare(["owner", "sheet"]);
    expect(readSharedLogSheet).toHaveBeenCalledWith("sheet", true, "owner");
  });
  it("offers login on unavailable pages without exposing private details and preserves query parameters", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const page = await SharedLogbookPage({ params: Promise.resolve({ segments: ["owner", "private-sheet"] }), searchParams: Promise.resolve({ view: "list", from: "2026-10-01" }) });
    const markup = renderToStaticMarkup(createElement(I18nProvider, null, page));
    expect(markup).toContain("Logbook not available");
    expect(markup).toContain(">Log in</a>");
    expect(markup).toContain("callbackUrl=%2Fshare%2Fowner%2Fprivate-sheet%3Fview%3Dlist%26from%3D2026-10-01");
  });

  it.each([false, true])("shows a general login control only on non-embedded anonymous collections (embed=%s)", async embed => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    vi.mocked(readSharedLogSheets).mockResolvedValueOnce({ ownerId: "owner", ownerName: "Owner", sheets: [] });
    const page = await openShare(["owner"], embed);
    const markup = renderToStaticMarkup(createElement(I18nProvider, null, page));
    expect(markup.includes(">Log in</a>")).toBe(!embed);
  });

});
