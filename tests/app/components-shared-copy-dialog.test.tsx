import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode, ComponentProps } from "react";
import { I18nProvider } from "../../app/lib/i18n";
import { SharedCopyDialog, type CopyEntry } from "../../app/components/logbook/SharedCopyDialog";
import { SharedSheetsCollection } from "../../app/components/logbook/SharedSheetsCollection";
import { sampleLogSheets } from "../fixtures/logbook";

vi.mock("../../app/components/logbook/ModalLayer", () => ({ ModalLayer: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("../../app/components/logbook/OpenSeaMapView", () => ({ LogSheetsMapView: () => null }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const target = { id: "old-copy", title: "My edited voyage", boatId: "old-boat", boatName: "Existing boat", copiedAt: "2026-11-01T12:00:00Z", revision: 3, contentVersion: "a".repeat(64) };
const entries: CopyEntry[] = [{ id: "fresh", title: "New voyage", canIncludeCrew: true, canIncludePicture: true }, { id: "existing", title: "Existing voyage", canIncludeCrew: false, canIncludePicture: false }];
const response = (body: object, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
let root: ReactTestRenderer | undefined;
let fetchMock: ReturnType<typeof vi.fn<(url: string, options?: RequestInit) => Promise<Response>>>;
function text() { return JSON.stringify(root!.toJSON()); }
async function renderDialog(selected = entries) {
  await act(async () => { root = create(<I18nProvider><SharedCopyDialog ownerId="owner" entries={selected} returnPath="/share/owner" onClose={vi.fn()} /></I18nProvider>); });
}
async function submit() { await act(async () => { await root!.root.findByType("form").props.onSubmit({ preventDefault() {} }); }); }
function posts() { return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST"); }

describe("shared copy review", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() }, location: { origin: "https://ultilog.test" } });
    fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return response({ id: url.includes("fresh") ? "new-copy" : "old-copy" });
      if (url === "/api/logbook") return response({ boats: [{ id: "new-boat", name: "New boat" }] });
      return response({ copies: url.includes("existing") ? [target] : [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("shows checking progress for each pending sheet until its own preview resolves", async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/fresh/copy")) return new Promise<Response>(resolve => { resolveFirst = resolve; });
      if (url.includes("/existing/copy")) return new Promise<Response>(resolve => { resolveSecond = resolve; });
      return original(url, options);
    });
    await renderDialog();
    expect(root!.root.findAllByProps({ className: "shared-copy-spinner" })).toHaveLength(2);
    expect(root!.root.findByProps({ type: "submit" }).props.disabled).toBe(true);
    await act(async () => resolveFirst(new Response(JSON.stringify({ copies: [] }))));
    expect(root!.root.findAllByProps({ className: "shared-copy-spinner" })).toHaveLength(1);
    expect(root!.root.findAllByType("fieldset").map(row => row.props["aria-busy"])).toEqual([false, true]);
    expect(root!.root.findByProps({ type: "submit" }).props.disabled).toBe(true);
    await act(async () => resolveSecond(new Response(JSON.stringify({ copies: [target] }))));
    expect(root!.root.findAllByProps({ className: "shared-copy-spinner" })).toHaveLength(0);
    expect(root!.root.findByProps({ type: "submit" }).props.disabled).toBe(false);
    expect(root!.root.findAllByProps({ className: "shared-copy-badge" }).map(node => node.children.join(""))).toEqual(["New copy", "Update existing copy"]);
  });

  it("labels each sheet and sends independent create and update options", async () => {
    await renderDialog();
    expect(root!.root.findAllByProps({ className: "shared-copy-badge" }).map(node => node.children.join(""))).toEqual(["New copy", "Update existing copy"]);
    expect(text()).toContain("Existing boat");
    expect(text()).toContain("Updating overwrites local voyage contents");
    expect(text()).toContain("Confirm: 1 new, 1 updates");
    await submit();
    const [created, updated] = posts().map(([, options]) => JSON.parse(String(options!.body)));
    expect(created).toMatchObject({ action: "create", destinationBoatId: "new-boat", allowDuplicate: false, includeCrew: false, includePicture: false });
    expect(updated).toMatchObject({ action: "update", targetCopyId: target.id, destinationBoatId: "old-boat", expectedRevision: 3, expectedContentVersion: target.contentVersion });
    expect(root!.root.findAllByProps({ role: "status" })).toHaveLength(2);
    expect(push).not.toHaveBeenCalled();
  });

  it("allows choosing another existing copy or creating a new duplicate", async () => {
    fetchMock.mockImplementation((url: string) => url === "/api/logbook" ? response({ boats: [{ id: "new-boat", name: "New boat" }] }) : response({ copies: [target, { ...target, id: "second-copy", title: "Second copy" }] }));
    await renderDialog([entries[1]]);
    const action = root!.root.findAllByType("select").find(node => node.props.value === target.id)!;
    expect(action.findAllByType("option")).toHaveLength(3);
    await act(async () => action.props.onChange({ target: { value: "second-copy" } }));
    expect(text()).toContain("Second copy");
    await act(async () => action.props.onChange({ target: { value: "" } }));
    expect(root!.root.findByProps({ className: "shared-copy-badge" }).children).toEqual(["New copy"]);
    expect(text()).toContain("Confirm: 1 new, 0 updates");
  });

  it("keeps successful rows and retries only a failed row after reviewing it", async () => {
    let fail = true;
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => options?.method === "POST" && url.includes("existing") && fail ? response({ code: "revision_conflict" }, 409) : original(url, options));
    await renderDialog();
    await submit();
    expect(posts()).toHaveLength(2);
    expect(text()).toContain("The sheet or its copies changed");
    const retry = root!.root.findAllByType("button").find(node => node.children.join("").startsWith("Review again"))!;
    fail = false;
    await act(async () => { await retry.props.onClick(); });
    await submit();
    expect(posts()).toHaveLength(3);
    expect(posts().filter(([url]) => url.includes("fresh"))).toHaveLength(1);
    expect(text()).toContain("Confirm: 0 new, 0 updates");
  });

  it("does not repeat an uncertain create and requires a fresh review", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => options?.method === "POST" ? Promise.reject(new Error("Lost response")) : original(url, options));
    await renderDialog([entries[0]]);
    await submit();
    expect(text()).toContain("the sheet may already have been saved");
    await submit();
    expect(posts()).toHaveLength(1);
    fetchMock.mockImplementation((url: string) => url === "/api/logbook" ? original(url) : response({ copies: [target] }));
    const retry = root!.root.findAllByType("button").find(node => node.children.join("").startsWith("Review again"))!;
    await act(async () => { await retry.props.onClick(); });
    expect(root!.root.findByProps({ className: "shared-copy-badge" }).children).toEqual(["Update existing copy"]);
  });

  it("blocks overlapping submissions", async () => {
    let finish!: (response: Response) => void;
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => options?.method === "POST" ? new Promise<Response>(resolve => { finish = resolve; }) : original(url, options));
    await renderDialog([entries[0]]);
    await act(async () => {
      const handler = root!.root.findByType("form").props.onSubmit;
      const first = handler({ preventDefault() {} });
      await handler({ preventDefault() {} });
      expect(posts()).toHaveLength(1);
      finish(new Response(JSON.stringify({ id: "saved" })));
      await first;
    });
  });

  it("selects only eligible collection rows and disables batch actions for embedded views", async () => {
    const collection = sampleLogSheets.slice(0, 2).map((sheet, index) => ({ sheet, boatName: "Boat", capability: { canCopy: index === 0, missingRequiredSections: [], requiresAuthentication: false } }));
    await act(async () => { root = create(<I18nProvider><SharedSheetsCollection ownerId="owner" entries={collection} initialView="list" embedded={false} showEmbedding={false} isAuthenticated /></I18nProvider>); });
    const checkboxes = root!.root.findAllByProps({ type: "checkbox" });
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes.filter(node => node.props.disabled)).toHaveLength(1);
    await act(async () => checkboxes[0].props.onChange({ target: { checked: true } }));
    expect(text()).toContain("Copy selected (1)");
    await act(async () => { root!.update(<I18nProvider><SharedSheetsCollection ownerId="owner" entries={collection} initialView="list" embedded showEmbedding={false} isAuthenticated /></I18nProvider>); });
    expect(root!.root.findAllByProps({ type: "checkbox" })).toHaveLength(0);
  });
});
