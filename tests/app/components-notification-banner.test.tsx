import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBanner } from "../../app/components/NotificationBanner";

vi.mock("../../app/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("notification banner", () => {
  let root: ReactTestRenderer;
  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    await act(async () => root?.unmount());
    vi.useRealTimers();
  });

  it("dismisses success after five seconds and restarts the timer for a new message", async () => {
    const dismiss = vi.fn();
    await act(async () => { root = create(<NotificationBanner message="Saved" onDismiss={dismiss} />); });
    await act(async () => { vi.advanceTimersByTime(4999); });
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { root.update(<NotificationBanner message="Updated" onDismiss={dismiss} />); });
    await act(async () => { vi.advanceTimersByTime(4999); });
    expect(dismiss).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(dismiss).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("keeps errors until the close button is clicked", async () => {
    const dismiss = vi.fn();
    await act(async () => { root = create(<NotificationBanner message="Upload failed" kind="error" onDismiss={dismiss} />); });
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(dismiss).not.toHaveBeenCalled();
    expect(root.root.findByProps({ role: "alert" })).toBeTruthy();
    await act(async () => { root.root.findByType("button").props.onClick(); });
    expect(dismiss).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("cleans up the success timer when an error replaces it", async () => {
    const dismiss = vi.fn();
    await act(async () => { root = create(<NotificationBanner message="Saved" onDismiss={dismiss} />); });
    await act(async () => { root.update(<NotificationBanner message="Failed" kind="error" onDismiss={dismiss} />); });
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(dismiss).not.toHaveBeenCalled();
  });
});
